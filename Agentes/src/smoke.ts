import { AuthenticationError, choice, noul, score } from "@typesafe-ai/sdk";
import { createJevClient } from "./jev.js";

async function main(): Promise<void> {
  const client = createJevClient();

  const response = await client.systemOne({
    state: { ticket: "I was charged twice this month. Please fix this ASAP." },
    questions: {
      category: choice("What is `ticket` about?", {
        billing: "Payments, charges, invoices or refunds",
        technical: "Bugs, errors or product malfunction",
        other: "Anything else",
      }),
      needsRefund: noul("Does the customer in `ticket` ask for money back or a charge reversal?"),
      urgency: score("How urgent is `ticket`?", [
        "Low: no time pressure expressed",
        "Medium: wants it resolved soon",
        "High: explicitly demands immediate action",
      ]),
    },
  });

  const { category, needsRefund, urgency } = response.answers;
  console.log("model:", response.model);
  console.log("category:", category.choice, `(confidence ${category.confidence.toFixed(2)})`);
  console.log("needsRefund:", needsRefund.noul.toFixed(2));
  console.log("urgency:", urgency.score.toFixed(2), `(confidence ${urgency.confidence.toFixed(2)})`);
  console.log("usage:", response.usage);
}

main().catch((error: unknown) => {
  if (error instanceof AuthenticationError) {
    console.error("Jev rejected the API key. Check TYPESAFE_API_KEY in .env.");
  } else {
    console.error("Jev smoke test failed:", error);
  }
  process.exitCode = 1;
});
