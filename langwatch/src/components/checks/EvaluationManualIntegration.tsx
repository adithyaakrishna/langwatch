import {
  Box,
  Checkbox,
  HStack,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { useOrganizationTeamProject } from "../../hooks/useOrganizationTeamProject";
import type { AVAILABLE_EVALUATORS } from "../../trace_checks/evaluators.generated";
import { api } from "../../utils/api";
import { RenderCode } from "../code/RenderCode";
import { langwatchEndpoint } from "../code/langwatchEndpointEnv";
import { EvaluationExecutionMode } from "@prisma/client";
import type { UseFormReturn } from "react-hook-form";
import type { CheckConfigFormData } from "./CheckConfigForm";
import { Info } from "react-feather";

export function EvaluationManualIntegration({
  slug,
  evaluatorDefinition,
  form,
}: {
  slug: string;
  evaluatorDefinition: (typeof AVAILABLE_EVALUATORS)[keyof typeof AVAILABLE_EVALUATORS];
  form: UseFormReturn<CheckConfigFormData>;
}) {
  const checkType = form.watch("checkType");
  const executionMode = form.watch("executionMode");
  const isGuardrail = executionMode === EvaluationExecutionMode.AS_GUARDRAIL;
  const settings = form.watch("settings");
  const storeSettingsOnCode = form.watch("storeSettingsOnCode");
  const checkSlug = storeSettingsOnCode ? checkType : slug;

  const { project } = useOrganizationTeamProject();
  const isOutputMandatory =
    evaluatorDefinition.requiredFields.includes("output");
  const isOutputOptional =
    evaluatorDefinition.optionalFields.includes("output");
  const projectAPIKey = api.project.getProjectAPIKey.useQuery(
    {
      projectId: project?.id ?? "",
    },
    {
      enabled: !!project,
    }
  );

  const PythonInstructions = ({ async }: { async: boolean }) => {
    const contextsParams = evaluatorDefinition.requiredFields.includes(
      "contexts"
    )
      ? `\n        contexts=["retrieved snippet 1", "retrieved snippet 2"],`
      : evaluatorDefinition.optionalFields.includes("contexts")
      ? `\n        contexts=["retrieved snippet 1", "retrieved snippet 2"], # optional`
      : "";
    const inputParams = evaluatorDefinition.requiredFields.includes("input")
      ? `\n        input=user_input,`
      : evaluatorDefinition.optionalFields.includes("input")
      ? `\n        input=user_input, # optional`
      : "";
    const outputParams = evaluatorDefinition.requiredFields.includes("output")
      ? `\n        output=generated_response,`
      : evaluatorDefinition.optionalFields.includes("output")
      ? `\n        output=generated_response, # optional`
      : "";
    const settingsParams = storeSettingsOnCode
      ? `\n        settings=${JSON.stringify(settings, null, 2)
          .replace(/true/g, "True")
          .replace(/false/g, "False")
          .split("\n")
          .map((line, index) => (index === 0 ? line : "        " + line))
          .join("\n")},`
      : "";

    return (
      <VStack align="start" width="full" spacing={3}>
        <Text fontSize={14}>
          Add this import at the top of the file where the LLM call happens:
        </Text>
        <Box className="markdown" width="full">
          <RenderCode code={`import langwatch`} language="python" />
        </Box>
        {(!isOutputMandatory || !isGuardrail) && (
          <>
            <Text fontSize={14}>
              {isGuardrail
                ? isOutputMandatory
                  ? "Then, after calling your LLM, check for the guardrail:"
                  : "Then, either before or after calling your LLM, check for the guardrail:"
                : "Then, pass in the message data to get the result of the evaluator:"}
            </Text>
            <Box className="markdown" width="full">
              <RenderCode
                code={`@langwatch.span()
def llm_step():
    ... # your existing code

    ${isGuardrail ? "guardrail" : "result"} = ${
      async
        ? `await langwatch.get_current_span().async_evaluate`
        : `langwatch.get_current_span().evaluate`
    }(
        "${checkSlug}",${
          isGuardrail ? "\n        as_guardrail=True,\n        input=user_input," : inputParams
        }${outputParams}${contextsParams}${settingsParams}
    )
${
  isGuardrail
    ? `
    if not guardrail.passed:
        # handle the guardrail here
        return "I'm sorry, I can't do that."`
    : `
    print(result)`
}`}
                language="python"
              />
            </Box>
          </>
        )}
      </VStack>
    );
  };

  const settingsParamsCurl = storeSettingsOnCode
    ? `,\n  "settings": ${JSON.stringify(settings, null, 2)
        .split("\n")
        .map((line, index) => (index === 0 ? line : "  " + line))
        .join("\n")}`
    : "";

  return (
    <VStack spacing={4} align="start" width="full">
      <Heading as="h4" fontSize={16} fontWeight={500} paddingTop={4}>
        {executionMode === EvaluationExecutionMode.MANUALLY
          ? "Manual Integration"
          : "Guardrail Integration"}
      </Heading>
      <HStack>
        <Text fontSize={14}>
          This{" "}
          {executionMode === EvaluationExecutionMode.MANUALLY
            ? "evaluator"
            : "guardrail"}{" "}
          uses:
        </Text>
        {evaluatorDefinition.requiredFields
          .map((field) => (
            <Tag key={field} colorScheme="blue">
              {field} (required)
            </Tag>
          ))
          .concat(
            evaluatorDefinition.optionalFields.map((field) => (
              <Tag key={field}>{field} (optional)</Tag>
            ))
          )}
      </HStack>
      <Text fontSize={14}>
        Follow the code example below to integrate this{" "}
        {isGuardrail ? "guardrail" : "evaluator"} in your LLM pipeline, save
        changes first for the {isGuardrail ? "guardrail" : "evaluator"} to work.
      </Text>
      <HStack>
        <Checkbox {...form.register("storeSettingsOnCode")}>
          Store settings on code
        </Checkbox>
        <Tooltip label="Store the settings on the code to keep it versioned on your side instead of on LangWatch dashboard.">
          <Info size={16} />
        </Tooltip>
      </HStack>
      <Tabs width="full">
        <TabList marginBottom={4}>
          <Tab>Python</Tab>
          <Tab>Python (Async)</Tab>
          <Tab>Curl</Tab>
        </TabList>

        <TabPanels>
          <TabPanel padding={0}>
            <PythonInstructions async={false} />
          </TabPanel>
          <TabPanel padding={0}>
            <PythonInstructions async={true} />
          </TabPanel>
          <TabPanel padding={0}>
            <VStack align="start" width="full" spacing={3}>
              <Box className="markdown" width="full">
                <RenderCode
                  code={`# Set your API key and endpoint URL
API_KEY="${projectAPIKey.data?.apiKey ?? "your_langwatch_api_key"}"

# Use curl to send the POST request, e.g.:
curl -X POST "${langwatchEndpoint()}/api/evaluations/${checkSlug}/evaluate" \\
     -H "X-Auth-Token: $API_KEY" \\
     -H "Content-Type: application/json" \\
     -d @- <<EOF
{
  "trace_id": "trace-123",
  "data": {
    ${evaluatorDefinition.requiredFields
      .map((field) => `"${field}": "${field} content"`)
      .concat(
        evaluatorDefinition.optionalFields.map(
          (field) => `"${field}": "${field} content (optional)"`
        )
      )
      .join(",\n    ")}
  }${isGuardrail ? `,\n  "as_guardrail": true` : ""}${settingsParamsCurl}
}
EOF`}
                  language="bash"
                />
              </Box>
              <Text>Response:</Text>
              <Box className="markdown" width="full">
                <RenderCode
                  code={JSON.stringify(
                    {
                      status: "processed",
                      passed: true,
                      score: 1,
                      details: "possible explanation",
                    },
                    null,
                    2
                  )}
                  language="json"
                />
              </Box>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
}
