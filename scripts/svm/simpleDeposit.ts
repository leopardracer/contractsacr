import * as anchor from "@coral-xyz/anchor";
import { BN, Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SvmSpoke } from "../../target/types/svm_spoke";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Set up the provider
const provider = AnchorProvider.env();
anchor.setProvider(provider);
const idl = require("../../target/idl/svm_spoke.json");
const program = new Program<SvmSpoke>(idl, provider);
const programId = program.programId;

// Parse arguments
const argv = yargs(hideBin(process.argv))
  .option("seed", { type: "string", demandOption: true, describe: "Seed for the state account PDA" })
  .option("recipient", { type: "string", demandOption: true, describe: "Recipient public key" })
  .option("inputToken", { type: "string", demandOption: true, describe: "Input token public key" })
  .option("outputToken", { type: "string", demandOption: true, describe: "Output token public key" })
  .option("inputAmount", { type: "number", demandOption: true, describe: "Input amount" })
  .option("outputAmount", { type: "number", demandOption: true, describe: "Output amount" })
  .option("destinationChainId", { type: "string", demandOption: true, describe: "Destination chain ID" }).argv;

async function depositV3(): Promise<void> {
  const resolvedArgv = await argv;
  const seed = new BN(resolvedArgv.seed);
  const recipient = new PublicKey(resolvedArgv.recipient);
  const inputToken = new PublicKey(resolvedArgv.inputToken);
  const outputToken = new PublicKey(resolvedArgv.outputToken);
  const inputAmount = new BN(resolvedArgv.inputAmount);
  const outputAmount = new BN(resolvedArgv.outputAmount);
  const destinationChainId = new BN(resolvedArgv.destinationChainId);
  const exclusiveRelayer = PublicKey.default;
  const quoteTimestamp = Math.floor(Date.now() / 1000);
  const fillDeadline = quoteTimestamp + 3600; // 1 hour from now
  const exclusivityDeadline = 0;
  const message = Buffer.from([]); // Convert to Buffer

  // Define the state account PDA
  const [statePda, _] = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), seed.toArrayLike(Buffer, "le", 8)],
    programId
  );

  // Define the route account PDA
  const [routePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("route"), inputToken.toBytes(), statePda.toBytes(), destinationChainId.toArrayLike(Buffer, "le", 8)],
    programId
  );

  // Define the signer (replace with your actual signer)
  const signer = provider.wallet.publicKey;

  console.log("Depositing V3...");
  console.table([
    { property: "seed", value: seed.toString() },
    { property: "recipient", value: recipient.toString() },
    { property: "inputToken", value: inputToken.toString() },
    { property: "outputToken", value: outputToken.toString() },
    { property: "inputAmount", value: inputAmount.toString() },
    { property: "outputAmount", value: outputAmount.toString() },
    { property: "destinationChainId", value: destinationChainId.toString() },
    { property: "quoteTimestamp", value: quoteTimestamp.toString() },
    { property: "fillDeadline", value: fillDeadline.toString() },
    { property: "exclusivityDeadline", value: exclusivityDeadline.toString() },
    { property: "programId", value: programId.toString() },
    { property: "providerPublicKey", value: provider.wallet.publicKey.toString() },
    { property: "statePda", value: statePda.toString() },
    { property: "routePda", value: routePda.toString() },
  ]);

  // Create ATA for the input token to be stored by state (vault).
  const vault = getAssociatedTokenAddressSync(
    inputToken,
    statePda,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const tx = await (
    program.methods.depositV3(
      signer,
      recipient,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      destinationChainId,
      exclusiveRelayer,
      quoteTimestamp,
      fillDeadline,
      exclusivityDeadline,
      message
    ) as any
  )
    .accounts({
      state: statePda,
      route: routePda,
      signer: signer,
      userTokenAccount: getAssociatedTokenAddressSync(inputToken, signer),
      vault: vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      mint: inputToken,
    })
    .rpc();

  console.log("Transaction signature:", tx);
}

// Run the depositV3 function
depositV3();
