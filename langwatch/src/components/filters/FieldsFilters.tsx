import {
  Box,
  Button,
  Checkbox,
  FocusLock,
  FormControl,
  HStack,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  RangeSlider,
  RangeSliderFilledTrack,
  RangeSliderThumb,
  RangeSliderTrack,
  Skeleton,
  Spacer,
  Tag,
  Text,
  VStack,
  useDisclosure,
  useTheme
} from "@chakra-ui/react";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { UseTRPCQueryResult } from "@trpc/react-query/shared";
import type { inferRouterOutputs } from "@trpc/server";
import { cloneDeep } from "lodash";
import numeral from "numeral";
import React, { useEffect } from "react";
import { ChevronDown, Search, X } from "react-feather";
import { useDebounceValue } from "usehooks-ts";
import { useFilterParams, type FilterParam } from "../../hooks/useFilterParams";
import { useOrganizationTeamProject } from "../../hooks/useOrganizationTeamProject";
import type { AppRouter } from "../../server/api/root";
import { availableFilters } from "../../server/filters/registry";
import type { FilterDefinition, FilterField } from "../../server/filters/types";
import { api } from "../../utils/api";

export function FieldsFilters() {
  const filterKeys: FilterField[] = [
    "spans.model",
    "metadata.labels",
    "trace_checks.passed",
    "trace_checks.score",
    "trace_checks.state",
    "events.metrics.value",
    "metadata.user_id",
    "metadata.thread_id",
    "metadata.customer_id",
  ];

  const filters: [FilterField, FilterDefinition][] = filterKeys.map((id) => [
    id,
    availableFilters[id],
  ]);

  return (
    <VStack align="start" width="full" spacing={6}>
      <Heading size="md">Filters</Heading>
      <VStack spacing={4} width="full">
        {filters.map(([id, filter]) => (
          <FieldsFilter key={id} filterId={id} filter={filter} />
        ))}
      </VStack>
    </VStack>
  );
}

function FieldsFilter({
  filterId,
  filter,
}: {
  filterId: FilterField;
  filter: FilterDefinition;
}) {
  const theme = useTheme();
  const gray400 = theme.colors.gray["400"];

  const { setFilter, filters } = useFilterParams();

  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useDebounceValue("", 300);
  const { onOpen, onClose, isOpen } = useDisclosure();
  const current = filters[filterId] ?? [];

  const currentStringList = Array.isArray(current)
    ? current
    : Object.keys(current);

  return (
    <FormControl>
      <Popover
        matchWidth={true}
        initialFocusRef={searchRef}
        isOpen={isOpen}
        onOpen={onOpen}
        onClose={onClose}
      >
        <PopoverTrigger>
          <Button
            variant="outline"
            width="100%"
            background="white"
            fontWeight="normal"
            _hover={{ background: "white" }}
          >
            <HStack width="full" spacing={0}>
              <Text color="gray.500" fontWeight="500" paddingRight={4}>
                {filter.name}
              </Text>
              {currentStringList.length > 0 ? (
                <>
                  <Text noOfLines={1} wordBreak="break-all" display="block">
                    {currentStringList.join(", ")}
                  </Text>
                  <Spacer />
                  {currentStringList.length > 1 && (
                    <Tag
                      width="fit-content"
                      padding={0}
                      justifyContent="center"
                      display="flex"
                    >
                      {currentStringList.length}
                    </Tag>
                  )}
                  <Button
                    variant="unstyled"
                    width="fit-content"
                    display="flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilter(filterId, []);
                    }}
                  >
                    <X width={12} />
                  </Button>
                </>
              ) : (
                <>
                  <Text color="gray.400">Any</Text>
                  <Spacer />
                </>
              )}
              <ChevronDown width={12} style={{ minWidth: "12px" }} />
            </HStack>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          marginTop="-8px"
          width="100%"
          motionProps={{
            variants: {
              enter: {},
              exit: {},
            },
          }}
        >
          <FocusLock restoreFocus persistentFocus={false}>
            <PopoverHeader paddingY={1} paddingX={1}>
              <InputGroup>
                <InputLeftElement>
                  <Search width={16} color={gray400} />
                </InputLeftElement>
                <Input
                  placeholder="Search..."
                  border="none"
                  ref={searchRef}
                  _focusVisible={{ boxShadow: "none" }}
                  onChange={(e) => {
                    setQuery(e.target.value);
                  }}
                />
              </InputGroup>
            </PopoverHeader>
            <PopoverBody paddingY={1}>
              {isOpen && (
                <NestedListSelection
                  query={query}
                  current={current}
                  keysAhead={[
                    ...(filter.requiresKey ? [filter.requiresKey.filter] : []),
                    ...(filter.requiresSubkey
                      ? [filter.requiresSubkey.filter]
                      : []),
                    filterId,
                  ]}
                />
              )}
            </PopoverBody>
          </FocusLock>
        </PopoverContent>
      </Popover>
    </FormControl>
  );
}

function NestedListSelection({
  query,
  current,
  keysAhead,
  keysBefore = [],
}: {
  query: string;
  current: FilterParam;
  keysAhead: FilterField[];
  keysBefore?: string[];
}) {
  const { setFilter } = useFilterParams();

  const filterId = keysAhead[0];
  if (!filterId) {
    console.warn("NestedListSelection called with empty keysAhead");
    return null;
  }

  let currentValues = current;
  keysBefore.forEach((key) => {
    if (!Array.isArray(currentValues)) {
      currentValues = currentValues[key] ?? [];
    }
  });
  if (!Array.isArray(currentValues)) {
    currentValues = Object.keys(currentValues);
  }

  return (
    <ListSelection
      filterId={filterId}
      query={query}
      currentValues={currentValues}
      keys={keysBefore}
      onChange={(values) => {
        const topLevelFilterId = keysAhead[keysAhead.length - 1]!;
        if (keysAhead.length === 1 && keysBefore.length == 0) {
          setFilter(topLevelFilterId, values);
          return;
        }

        let current_ = Array.isArray(current) ? {} : cloneDeep(current);
        keysBefore
          .slice(0, keysAhead.length + keysBefore.length - 2)
          .forEach((key) => {
            const next = current_[key];
            if (next) {
              current_ = Array.isArray(next) ? {} : next;
            }
          });

        if (keysAhead.length === 1) {
          const lastKey = keysBefore[keysBefore.length - 1]!;
          current_[lastKey] = values;
        } else {
          for (const key of Object.keys(current_)) {
            if (!(key in values)) {
              delete current_[key];
            }
          }
          for (const key of values) {
            if (!current_[key]) {
              current_[key] = [];
            }
          }
        }

        setFilter(topLevelFilterId, current_);
      }}
      {...(keysAhead.length > 1
        ? {
            nested: (key) => {
              return (
                <NestedListSelection
                  query={query}
                  current={current}
                  keysAhead={keysAhead.slice(1)}
                  keysBefore={[...keysBefore, key]}
                />
              );
            },
          }
        : {})}
    />
  );
}

function ListSelection({
  filterId,
  query,
  keys,
  currentValues,
  onChange,
  nested,
}: {
  filterId: FilterField;
  query: string;
  keys?: string[];
  currentValues: string[];
  onChange: (value: string[]) => void;
  nested?: (key: string) => React.ReactNode;
}) {
  const { project } = useOrganizationTeamProject();

  const filter = availableFilters[filterId];

  const filterData = api.analytics.dataForFilter.useQuery(
    {
      projectId: project?.id ?? "",
      field: filterId,
      query: query,
      key: keys?.[0],
      subkey: keys?.[1],
    },
    {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
      enabled: !!project,
    }
  );

  if (filter.type === "numeric") {
    return (
      <RangeFilter
        filterData={filterData}
        currentValues={currentValues}
        onChange={onChange}
      />
    );
  }

  return (
    <VStack
      width="full"
      align="start"
      spacing={2}
      padding={2}
      maxHeight="300px"
      overflowY="scroll"
    >
      {filterData.data?.options.map(({ field, label }) => (
        <React.Fragment key={field}>
          <Checkbox
            paddingY={1}
            spacing={3}
            isChecked={currentValues.includes(field.toString())}
            onChange={(_e) => {
              if (currentValues.includes(field.toString())) {
                onChange(
                  currentValues.filter((v) => v.toString() !== field.toString())
                );
              } else {
                onChange([...currentValues, field]);
              }
            }}
          >
            {label}
          </Checkbox>
          <Box width="full" paddingLeft={4}>
            {nested && currentValues.includes(field) && nested(field)}
          </Box>
        </React.Fragment>
      ))}
      {filterData.data && filterData.data.options.length === 0 && (
        <Text>No options found</Text>
      )}
      {filterData.isLoading &&
        Array.from({ length: 5 }).map((_, i) => (
          <Checkbox key={i} isChecked={false} paddingY={2} spacing={3}>
            <Skeleton height="12px" width="120px" />
          </Checkbox>
        ))}
    </VStack>
  );
}

function RangeFilter({
  filterData,
  currentValues,
  onChange,
}: {
  filterData: UseTRPCQueryResult<
    inferRouterOutputs<AppRouter>["analytics"]["dataForFilter"],
    TRPCClientErrorLike<AppRouter>
  >;
  currentValues: string[];
  onChange: (value: string[]) => void;
}) {
  let min = +numeral(
    +(filterData.data?.options.find((o) => o.label === "min")?.field ?? 0)
  ).format("0.[0]");
  let max = +numeral(
    +(filterData.data?.options.find((o) => o.label === "max")?.field ?? 0)
  ).format("0.[0]");
  if (min === max && min === 0) {
    min = 0;
    max = 1;
  }
  if (min === max && min !== 0) {
    min = 0;
  }

  useEffect(() => {
    if (filterData.data) {
      onChange([min.toString(), max.toString()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]);

  return (
    <HStack width="full" spacing={4}>
      <Input
        width="72px"
        paddingX={2}
        textAlign="center"
        value={currentValues[0]}
        onChange={(e) => {
          onChange([e.target.value, currentValues[1] ?? max.toString()]);
        }}
      />
      <RangeSlider
        colorScheme="orange"
        // eslint-disable-next-line jsx-a11y/aria-proptypes
        aria-label={["min", "max"]}
        min={min}
        max={max}
        step={0.1}
        value={
          currentValues && currentValues.length == 2
            ? currentValues?.map((v) => +v)
            : [min, max]
        }
        onChange={(values) => {
          onChange(values.map((v) => v.toString()));
        }}
      >
        <RangeSliderTrack>
          <RangeSliderFilledTrack />
        </RangeSliderTrack>
        <RangeSliderThumb index={0} />
        <RangeSliderThumb index={1} />
      </RangeSlider>
      <Input
        width="72px"
        paddingX={2}
        textAlign="center"
        value={currentValues[1]}
        onChange={(e) => {
          onChange([currentValues[0] ?? min.toString(), e.target.value]);
        }}
      />
    </HStack>
  );
}
