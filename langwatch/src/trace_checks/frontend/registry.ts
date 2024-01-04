import type { CheckTypes, TraceCheckFrontendDefinition } from "../types";
import { CustomCheck } from "./customCheck";
import { PIICheck } from "./piiCheck";
import { ToxicityCheck } from "./toxicityCheck";
import { JailbreakCheck } from "./jailbreakCheck";
import { InconsistencyCheck } from "./inconsistencyCheck";
import { RagasAnswerRelevancy } from "./ragasAnswerRelevancy";
import { RagasFaithfulness } from "./ragasFaithfulness";
import { RagasContextPrecision } from "./ragasContextPrecision";

// TODO: allow checks to be run to be configurable by user
export const AVAILABLE_TRACE_CHECKS: {
  [K in CheckTypes]: TraceCheckFrontendDefinition<K>;
} = {
  pii_check: PIICheck,
  toxicity_check: ToxicityCheck,
  jailbreak_check: JailbreakCheck,
  ragas_answer_relevancy: RagasAnswerRelevancy,
  ragas_faithfulness: RagasFaithfulness,
  ragas_context_precision: RagasContextPrecision,
  inconsistency_check: InconsistencyCheck,
  custom: CustomCheck,
};

export const getTraceCheck = (name: string) => {
  for (const [key, val] of Object.entries(AVAILABLE_TRACE_CHECKS)) {
    if (key === name) return val;
  }
  return undefined;
};
