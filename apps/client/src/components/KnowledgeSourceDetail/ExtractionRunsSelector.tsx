import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { Col, Row } from 'components/ui/grid';
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group';

import styles from './ExtractionRunsSelector.module.css';

export interface KnowledgeSourceExtractionRun {
  id: string;
  title: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  ideaIds: string[];
}

interface ExtractionRunsSelectorProps {
  runs: KnowledgeSourceExtractionRun[];
  selectedRunId: string;
  inputIdPrefix: string;
  onSelectedRunIdChange: (id: string) => void;
  formatRunTitle: (run: KnowledgeSourceExtractionRun) => string;
}

function hasExtractionMeta(run: KnowledgeSourceExtractionRun) {
  return Boolean(
    run.model ||
    run.provider ||
    run.durationMs != null ||
    run.promptTokens != null ||
    run.completionTokens != null,
  );
}

export function ExtractionRunsSelector({
  runs,
  selectedRunId,
  inputIdPrefix,
  onSelectedRunIdChange,
  formatRunTitle,
}: ExtractionRunsSelectorProps) {
  if (runs.length <= 1) return null;

  return (
    <section className="section">
      <h2 className="section__heading">
        Extraction runs
        <span className="section__count">{runs.length}</span>
      </h2>
      <RadioGroup value={selectedRunId} onValueChange={onSelectedRunIdChange} className={styles.runSelector}>
        {runs.map((run) => {
          const inputId = `${inputIdPrefix}-${run.id}`;
          return (
            <label key={run.id} htmlFor={inputId} className={styles.runOption}>
              <Row justify="flex-start" align="center">
                <Col xs={1} className="flex justify-center">
                  <RadioGroupItem id={inputId} value={run.id} className={styles.runOptionRadio} />
                </Col>
                <Col xs={11}>
                  <span className={styles.runOptionBody}>
                    <span className={styles.runOptionHeader}>
                      <span className={styles.runOptionTitle}>{formatRunTitle(run)}</span>
                      <span className={styles.runOptionCount}>{run.ideaIds.length} ideas</span>
                    </span>
                    {hasExtractionMeta(run) ? (
                      <ExtractionModelCard
                        variant="compact-bar"
                        model={run.model}
                        provider={run.provider}
                        promptTokens={run.promptTokens}
                        completionTokens={run.completionTokens}
                        durationMs={run.durationMs}
                        showTotalTokens={false}
                      />
                    ) : null}
                  </span>
                </Col>
              </Row>
            </label>
          );
        })}
      </RadioGroup>
    </section>
  );
}
