import { PageHero } from 'components/PageHero/PageHero';
import { TtsPlayer } from 'components/TtsPlayer';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { Checkbox } from 'components/ui/checkbox';
import { Col, Row } from 'components/ui/grid';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { NativeSelect, NativeSelectOption } from 'components/ui/native-select';
import { Switch } from 'components/ui/switch';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import {
  CheckCircleIcon,
  FlagIcon,
  GripVerticalIcon,
  ListChecksIcon,
  RotateCcwIcon,
  XCircleIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TtsPlayerHandle } from 'components/TtsPlayer';
import type { DragEvent, KeyboardEvent } from 'react';

import { api } from 'lib/api';
import { INTERVIEW_DOMAIN_META, INTERVIEW_DOMAIN_STATS, INTERVIEW_QUESTIONS } from 'lib/interview-quiz-data';
import type {
  InterviewDifficultyFilter,
  InterviewSectionFilter,
  InterviewSessionConfig,
  InterviewSessionCount,
} from 'lib/interview-quiz-session';
import {
  createDefaultInterviewSessionConfig,
  createInitialOrder,
  createInterviewReplacementQuestion,
  createInterviewSessionQuestions,
  ordersMatch,
} from 'lib/interview-quiz-session';
import type { InterviewQuizStorage } from 'lib/interview-quiz-storage';
import {
  addInterviewAttempt,
  addInterviewPracticeFlag,
  loadInterviewQuizStorage,
  saveInterviewQuizStorage,
  toggleInterviewFlag,
} from 'lib/interview-quiz-storage';
import { usePageTitle } from 'lib/use-page-title';

import type {
  InterviewDomainId,
  InterviewMcqQuestion,
  InterviewOrderQuestion,
  InterviewQuestion,
} from 'types/interview-quiz.types';

import styles from './interviews.module.css';

type InterviewStage = 'setup' | 'question' | 'summary';

type InterviewAnswer =
  | { type: 'mcq'; selectedOptionId: string; correct: boolean }
  | { type: 'order'; submittedOrder: string[]; correct: boolean }
  | { type: 'unknown'; correct: false };

const DEFAULT_SELECTED_DOMAINS: InterviewDomainId[] = ['testing', 'apis', 'platform'];
const MIN_SPEECH_RATE = 1.15;
const MAX_SPEECH_RATE = MIN_SPEECH_RATE * 1.5;
const AUTOPLAY_READ_DELAY_MS = 500;
const MCQ_OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

function createInitialStorage(): InterviewQuizStorage {
  return loadInterviewQuizStorage();
}

function clampSpeechRate(value: number) {
  return Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, value));
}

function moveItemByDirection(items: string[], itemId: string, direction: -1 | 1) {
  const index = items.indexOf(itemId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;

  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function InterviewsPage() {
  usePageTitle('Interviews');

  const [storage, setStorage] = useState<InterviewQuizStorage>(createInitialStorage);
  const [selectedDomains, setSelectedDomains] = useState<InterviewDomainId[]>(DEFAULT_SELECTED_DOMAINS);
  const [config, setConfig] = useState<InterviewSessionConfig>(createDefaultInterviewSessionConfig);
  const [stage, setStage] = useState<InterviewStage>('setup');
  const [sessionQuestions, setSessionQuestions] = useState<InterviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState<InterviewAnswer | null>(null);
  const [sessionAnswers, setSessionAnswers] = useState<Record<string, InterviewAnswer>>({});
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const flaggedIds = useMemo(() => new Set(storage.flaggedIds), [storage.flaggedIds]);
  const currentQuestion = sessionQuestions[currentIndex];
  const answeredCount = Object.keys(sessionAnswers).length;
  const score = Object.values(sessionAnswers).filter((item) => item.correct).length;

  useEffect(() => {
    saveInterviewQuizStorage(storage);
  }, [storage]);

  useEffect(() => {
    setOrderIds(currentQuestion ? createInitialOrder(currentQuestion) : []);
  }, [currentQuestion]);

  useEffect(() => {
    if (stage !== 'question' || answer || !currentQuestion || currentQuestion.type !== 'mcq') return;
    const mcqQuestion = currentQuestion;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const index = Number(event.key) - 1;
      if (index < 0 || index > 3) return;

      const option = mcqQuestion.options[index];
      if (option) {
        event.preventDefault();
        submitMcq(mcqQuestion, option.id);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [answer, currentQuestion, stage]);

  function updateStorage(updater: (current: InterviewQuizStorage) => InterviewQuizStorage) {
    setStorage((current) => updater(current));
  }

  function toggleDomain(domain: InterviewDomainId, selected: boolean) {
    setSelectedDomains((current) => {
      if (selected) return current.includes(domain) ? current : [...current, domain];
      return current.filter((item) => item !== domain);
    });
  }

  function startSession(retryIds?: string[]) {
    const questions = createInterviewSessionQuestions({
      domains: selectedDomains,
      config,
      questions: INTERVIEW_QUESTIONS,
      storage,
      retryIds,
    });

    setSessionQuestions(questions);
    setCurrentIndex(0);
    setSessionAnswers({});
    setAnswer(null);
    setStage(questions.length > 0 ? 'question' : 'setup');
  }

  function submitMcq(question: InterviewMcqQuestion, selectedOptionId: string) {
    const nextAnswer: InterviewAnswer = {
      type: 'mcq',
      selectedOptionId,
      correct: selectedOptionId === question.correctOptionId,
    };

    recordAnswer(question, nextAnswer);
  }

  function submitOrder(question: InterviewOrderQuestion) {
    const submittedOrder = orderIds.length > 0 ? orderIds : createInitialOrder(question);
    const nextAnswer: InterviewAnswer = {
      type: 'order',
      submittedOrder,
      correct: ordersMatch(submittedOrder, question.correctOrder),
    };

    recordAnswer(question, nextAnswer);
  }

  function skipQuestion() {
    const replacement = createInterviewReplacementQuestion({
      domains: selectedDomains,
      config,
      questions: INTERVIEW_QUESTIONS,
      storage,
      excludeIds: sessionQuestions.map((question) => question.id),
    });

    if (!replacement) {
      goNext();
      return;
    }

    setSessionQuestions((current) =>
      current.map((question, index) => (index === currentIndex ? replacement : question)),
    );
    setAnswer(null);
  }

  function markDontKnow(question: InterviewQuestion) {
    recordAnswer(question, { type: 'unknown', correct: false });
    updateStorage((current) => addInterviewPracticeFlag(current, question.id));
  }

  function recordAnswer(question: InterviewQuestion, nextAnswer: InterviewAnswer) {
    setAnswer(nextAnswer);
    setSessionAnswers((current) => ({ ...current, [question.id]: nextAnswer }));
    updateStorage((current) =>
      addInterviewAttempt(current, {
        questionId: question.id,
        domain: question.domain,
        section: question.section,
        correct: nextAnswer.correct,
        selectedOptionId: nextAnswer.type === 'mcq' ? nextAnswer.selectedOptionId : undefined,
        submittedOrder: nextAnswer.type === 'order' ? nextAnswer.submittedOrder : undefined,
      }),
    );
  }

  function moveOrderItemTo(itemId: string, targetId: string) {
    setOrderIds((current) => {
      const fromIndex = current.indexOf(itemId);
      const targetIndex = current.indexOf(targetId);
      if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return current;

      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  function handleOrderKeyDown(event: KeyboardEvent<HTMLDivElement>, itemId: string) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    setOrderIds((current) => moveItemByDirection(current, itemId, event.key === 'ArrowUp' ? -1 : 1));
  }

  function goNext() {
    if (currentIndex + 1 >= sessionQuestions.length) {
      setStage('summary');
      return;
    }

    setCurrentIndex((current) => current + 1);
    setAnswer(null);
  }

  function retryMissed() {
    const missedIds = Object.entries(sessionAnswers)
      .filter(([, item]) => !item.correct)
      .map(([id]) => id);
    if (missedIds.length === 0) return;
    startSession(missedIds);
  }

  function setAutoRead(autoRead: boolean) {
    setConfig((current) => ({ ...current, autoRead }));
  }

  function setSpeechRate(value: string) {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;
    setConfig((current) => ({
      ...current,
      speechRate: clampSpeechRate(nextValue),
    }));
  }

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Practice"
          title="Interview Quiz"
          description="VALD-focused rehearsal across the completed static question bank."
          right={
            <div className={styles.autoReadControl}>
              <Label htmlFor="interview-auto-read">Autoplay</Label>
              <Switch id="interview-auto-read" checked={config.autoRead} onCheckedChange={setAutoRead} />
              <Label htmlFor="interview-speech-rate">Rate</Label>
              <Input
                id="interview-speech-rate"
                type="number"
                min={MIN_SPEECH_RATE}
                max={MAX_SPEECH_RATE}
                step="0.05"
                value={config.speechRate}
                className={styles.speechRateInput}
                onChange={(event) => setSpeechRate(event.target.value)}
              />
            </div>
          }
          meta={
            <>
              {INTERVIEW_QUESTIONS.length} questions · {storage.attempts.length} attempts ·{' '}
              {storage.flaggedIds.length} for practice
            </>
          }
        />
      }
    >
      <div className={styles.mainShell}>
        <PageList width="wide">
          {stage === 'setup' ? (
            <SetupView
              selectedDomains={selectedDomains}
              config={config}
              storage={storage}
              onToggleDomain={toggleDomain}
              onConfigChange={setConfig}
              onStart={() => startSession()}
            />
          ) : null}

          {stage === 'question' && currentQuestion ? (
            <QuestionView
              question={currentQuestion}
              answer={answer}
              nextQuestion={sessionQuestions[currentIndex + 1] ?? null}
              currentIndex={currentIndex}
              total={sessionQuestions.length}
              orderIds={orderIds}
              flagged={flaggedIds.has(currentQuestion.id)}
              autoRead={config.autoRead}
              speechRate={config.speechRate}
              onSubmitMcq={submitMcq}
              onSubmitOrder={submitOrder}
              onMoveOrderItemTo={moveOrderItemTo}
              onOrderKeyDown={handleOrderKeyDown}
              onToggleFlag={() =>
                updateStorage((current) => toggleInterviewFlag(current, currentQuestion.id))
              }
              onSkip={skipQuestion}
              onDontKnow={() => markDontKnow(currentQuestion)}
              onNext={goNext}
            />
          ) : null}

          {stage === 'summary' ? (
            <SummaryView
              questions={sessionQuestions}
              answers={sessionAnswers}
              score={score}
              answeredCount={answeredCount}
              storage={storage}
              onRetryMissed={retryMissed}
              onNewSession={() => {
                setStage('setup');
                setAnswer(null);
              }}
            />
          ) : null}
        </PageList>
      </div>
    </PageLayout>
  );
}

function SetupView({
  selectedDomains,
  config,
  storage,
  onToggleDomain,
  onConfigChange,
  onStart,
}: {
  selectedDomains: InterviewDomainId[];
  config: InterviewSessionConfig;
  storage: InterviewQuizStorage;
  onToggleDomain: (domain: InterviewDomainId, selected: boolean) => void;
  onConfigChange: (config: InterviewSessionConfig) => void;
  onStart: () => void;
}) {
  const selectedQuestionCount = INTERVIEW_QUESTIONS.filter((question) => {
    if (!selectedDomains.includes(question.domain)) return false;
    if (config.section !== 'both' && question.section !== config.section) return false;
    if (config.difficulty !== 'all' && question.difficulty !== config.difficulty) return false;
    return true;
  }).length;

  return (
    <div className={styles.setupStack}>
      <Row gutterWidth={12} className={styles.domainGrid}>
        {INTERVIEW_DOMAIN_META.map((domain) => {
          const stats = INTERVIEW_DOMAIN_STATS[domain.id];
          const accuracy = storage.domainAccuracy[domain.id];
          const selected = selectedDomains.includes(domain.id);

          return (
            <Col key={domain.id} xs={12} md={6} xl={3}>
              <label className={styles.domainCard} data-selected={selected || undefined}>
                <span className={styles.domainCardTop}>
                  <span>
                    <span className={styles.domainLabel}>{domain.label}</span>
                    <span className={styles.domainTitle}>{domain.title}</span>
                  </span>
                  <Checkbox
                    checked={selected}
                    aria-label={`${domain.title} selected`}
                    onCheckedChange={(checked) => onToggleDomain(domain.id, checked === true)}
                  />
                </span>
                <span className={styles.domainDescription}>{domain.description}</span>
                <span className={styles.domainMeta}>
                  <Badge variant="secondary">{stats.total} questions</Badge>
                  <Badge variant="outline">
                    {accuracy && accuracy.attempts > 0
                      ? `${Math.round((accuracy.correct / accuracy.attempts) * 100)}%`
                      : 'new'}
                  </Badge>
                </span>
              </label>
            </Col>
          );
        })}
      </Row>

      <Card className="py-5">
        <CardHeader>
          <CardTitle className={styles.cardTitle}>
            <ListChecksIcon aria-hidden />
            Session
          </CardTitle>
          <CardDescription>{selectedQuestionCount} matching questions available.</CardDescription>
        </CardHeader>
        <CardContent>
          <Row gutterWidth={12} align="flex-end">
            <Col xs={12} lg={9}>
              <Row gutterWidth={12}>
                <Col xs={12} md={4}>
                  <Label htmlFor="interview-count">Questions</Label>
                  <NativeSelect
                    id="interview-count"
                    className={styles.control}
                    value={String(config.count)}
                    onChange={(event) =>
                      onConfigChange({
                        ...config,
                        count: parseSessionCount(event.target.value),
                      })
                    }
                  >
                    <NativeSelectOption value="5">5</NativeSelectOption>
                    <NativeSelectOption value="10">10</NativeSelectOption>
                    <NativeSelectOption value="20">20</NativeSelectOption>
                    <NativeSelectOption value="all">All</NativeSelectOption>
                  </NativeSelect>
                </Col>
                <Col xs={12} md={4}>
                  <Label htmlFor="interview-section">Section</Label>
                  <NativeSelect
                    id="interview-section"
                    className={styles.control}
                    value={config.section}
                    onChange={(event) =>
                      onConfigChange({
                        ...config,
                        section: event.target.value as InterviewSectionFilter,
                      })
                    }
                  >
                    <NativeSelectOption value="both">Both</NativeSelectOption>
                    <NativeSelectOption value="glossary">Glossary</NativeSelectOption>
                    <NativeSelectOption value="depth">Depth</NativeSelectOption>
                  </NativeSelect>
                </Col>
                <Col xs={12} md={4}>
                  <Label htmlFor="interview-difficulty">Difficulty</Label>
                  <NativeSelect
                    id="interview-difficulty"
                    className={styles.control}
                    value={String(config.difficulty)}
                    onChange={(event) =>
                      onConfigChange({
                        ...config,
                        difficulty: parseDifficulty(event.target.value),
                      })
                    }
                  >
                    <NativeSelectOption value="all">All</NativeSelectOption>
                    <NativeSelectOption value="1">1</NativeSelectOption>
                    <NativeSelectOption value="2">2</NativeSelectOption>
                    <NativeSelectOption value="3">3</NativeSelectOption>
                  </NativeSelect>
                </Col>
              </Row>
            </Col>
            <Col xs={12} lg={3}>
              <div className={styles.startRow}>
                <Button
                  type="button"
                  className={styles.quizButton}
                  disabled={selectedDomains.length === 0 || selectedQuestionCount === 0}
                  onClick={onStart}
                >
                  START
                </Button>
              </div>
            </Col>
          </Row>
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionView({
  question,
  answer,
  nextQuestion,
  currentIndex,
  total,
  orderIds,
  flagged,
  autoRead,
  speechRate,
  onSubmitMcq,
  onSubmitOrder,
  onMoveOrderItemTo,
  onOrderKeyDown,
  onToggleFlag,
  onSkip,
  onDontKnow,
  onNext,
}: {
  question: InterviewQuestion;
  answer: InterviewAnswer | null;
  nextQuestion: InterviewQuestion | null;
  currentIndex: number;
  total: number;
  orderIds: string[];
  flagged: boolean;
  autoRead: boolean;
  speechRate: number;
  onSubmitMcq: (question: InterviewMcqQuestion, selectedOptionId: string) => void;
  onSubmitOrder: (question: InterviewOrderQuestion) => void;
  onMoveOrderItemTo: (itemId: string, targetId: string) => void;
  onOrderKeyDown: (event: KeyboardEvent<HTMLDivElement>, itemId: string) => void;
  onToggleFlag: () => void;
  onSkip: () => void;
  onDontKnow: () => void;
  onNext: () => void;
}) {
  const questionTtsRef = useRef<TtsPlayerHandle>(null);
  const feedbackTtsRef = useRef<TtsPlayerHandle>(null);
  const nextQuestionTtsRef = useRef<TtsPlayerHandle>(null);
  const questionSpokenText = getQuestionSpokenText(question);
  const explanationSpokenText = getExplanationSpokenText(question);
  const nextQuestionSpokenText = nextQuestion ? getQuestionSpokenText(nextQuestion) : '';

  useEffect(() => {
    questionTtsRef.current?.stop();
    feedbackTtsRef.current?.stop();

    if (!autoRead || answer) return;

    const timeoutId = window.setTimeout(() => {
      questionTtsRef.current?.playFromStart();
    }, AUTOPLAY_READ_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [answer, autoRead, question.id]);

  useEffect(() => {
    if (answer) return;

    let cancelled = false;
    void feedbackTtsRef.current?.preload().then(() => {
      if (!cancelled) void nextQuestionTtsRef.current?.preload();
    });

    return () => {
      cancelled = true;
    };
  }, [answer, explanationSpokenText, nextQuestionSpokenText, question.id, speechRate]);

  useEffect(() => {
    if (!autoRead || !answer) return;

    questionTtsRef.current?.stop();
    feedbackTtsRef.current?.playFromStart();
  }, [answer, autoRead, question.id]);

  return (
    <Card className={styles.questionCard}>
      <CardHeader>
        <div className={styles.questionTop}>
          <div className={styles.badges}>
            <Badge variant="secondary" className={styles.questionBadge}>
              {currentIndex + 1} / {total}
            </Badge>
            <Badge variant="outline" className={styles.questionBadge}>
              {question.domain}
            </Badge>
            <Badge variant="outline" className={styles.questionBadge}>
              {question.section}
            </Badge>
            <Badge variant="outline" className={styles.questionBadge}>
              difficulty {question.difficulty}
            </Badge>
          </div>
          <Button
            type="button"
            size="sm"
            variant={flagged ? 'default' : 'outline'}
            className={styles.quizButton}
            onClick={onToggleFlag}
          >
            <FlagIcon aria-hidden />
            Flag for practice
          </Button>
        </div>
        <div className={styles.stemRow}>
          <CardTitle className={styles.stem}>{renderStemText(question.stem)}</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={styles.quizButton}
            onClick={() => {
              feedbackTtsRef.current?.stop();
              questionTtsRef.current?.playFromStart();
            }}
          >
            <RotateCcwIcon aria-hidden />
            Replay
          </Button>
          <TtsPlayer
            ref={questionTtsRef}
            key={`stem-${question.id}`}
            variant="compact"
            text={questionSpokenText}
            speed={speechRate}
            className={styles.hiddenTts}
          />
        </div>
      </CardHeader>
      <CardContent className={styles.questionBody}>
        {question.code ? <CodeBlock lang={question.code.lang} content={question.code.content} /> : null}

        {question.type === 'mcq' ? (
          <McqAnswerPanel question={question} answer={answer} onSubmit={onSubmitMcq} />
        ) : (
          <OrderAnswerPanel
            question={question}
            answer={answer}
            orderIds={orderIds}
            onSubmit={onSubmitOrder}
            onMoveItemTo={onMoveOrderItemTo}
            onItemKeyDown={onOrderKeyDown}
          />
        )}

        {!answer ? <QuestionFallbackActions onSkip={onSkip} onDontKnow={onDontKnow} /> : null}
        {answer ? (
          <Feedback question={question} answer={answer} onNext={onNext} isLast={currentIndex + 1 >= total} />
        ) : null}
        <TtsPlayer
          ref={feedbackTtsRef}
          key={`explanation-${question.id}`}
          variant="compact"
          text={explanationSpokenText}
          speed={speechRate}
          className={styles.hiddenTts}
        />
        {nextQuestion ? (
          <TtsPlayer
            ref={nextQuestionTtsRef}
            key={`next-stem-${nextQuestion.id}`}
            variant="compact"
            text={nextQuestionSpokenText}
            speed={speechRate}
            className={styles.hiddenTts}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function McqAnswerPanel({
  question,
  answer,
  onSubmit,
}: {
  question: InterviewMcqQuestion;
  answer: InterviewAnswer | null;
  onSubmit: (question: InterviewMcqQuestion, selectedOptionId: string) => void;
}) {
  return (
    <Row gutterWidth={10} className={styles.optionsGrid}>
      {question.options.map((option, index) => {
        const isSelected = answer?.type === 'mcq' && answer.selectedOptionId === option.id;
        const isCorrect = option.id === question.correctOptionId;

        return (
          <Col key={option.id} xs={12} md={6}>
            <Button
              type="button"
              variant="outline"
              className={`${styles.optionButton} ${styles.quizButton}`}
              data-selected={isSelected || undefined}
              data-correct={answer && isCorrect ? true : undefined}
              data-wrong={answer && isSelected && !isCorrect ? true : undefined}
              disabled={answer != null}
              onClick={() => onSubmit(question, option.id)}
            >
              <span className={styles.optionIndex}>{MCQ_OPTION_LABELS[index] ?? index + 1}</span>
              <span className={styles.optionText}>{renderInlineText(option.text)}</span>
            </Button>
          </Col>
        );
      })}
    </Row>
  );
}

function OrderAnswerPanel({
  question,
  answer,
  orderIds,
  onSubmit,
  onMoveItemTo,
  onItemKeyDown,
}: {
  question: InterviewOrderQuestion;
  answer: InterviewAnswer | null;
  orderIds: string[];
  onSubmit: (question: InterviewOrderQuestion) => void;
  onMoveItemTo: (itemId: string, targetId: string) => void;
  onItemKeyDown: (event: KeyboardEvent<HTMLDivElement>, itemId: string) => void;
}) {
  const itemById = new Map(question.items.map((item) => [item.id, item]));
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  function startDrag(event: DragEvent<HTMLDivElement>, itemId: string) {
    if (answer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    setDraggingItemId(itemId);
  }

  function dragOver(event: DragEvent<HTMLDivElement>, itemId: string) {
    if (answer || draggingItemId === itemId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverItemId(itemId);
  }

  function dropItem(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    const itemId = event.dataTransfer.getData('text/plain') || draggingItemId;
    setDraggingItemId(null);
    setDragOverItemId(null);
    if (!itemId || itemId === targetId) return;
    onMoveItemTo(itemId, targetId);
  }

  function endDrag() {
    setDraggingItemId(null);
    setDragOverItemId(null);
  }

  if (answer?.type === 'order') {
    return (
      <div className={styles.orderPanel}>
        <OrderCorrections question={question} answer={answer} />
        <div className={styles.orderActions}>
          <Button type="button" className={styles.quizButton} disabled>
            Check order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.orderPanel}>
      {orderIds.map((itemId, index) => {
        const item = itemById.get(itemId);
        if (!item) return null;

        return (
          <div
            key={itemId}
            tabIndex={answer ? -1 : 0}
            className={styles.orderItem}
            draggable={answer == null}
            data-dragging={draggingItemId === itemId || undefined}
            data-drag-over={dragOverItemId === itemId || undefined}
            onDragStart={(event) => startDrag(event, itemId)}
            onDragOver={(event) => dragOver(event, itemId)}
            onDragLeave={() => setDragOverItemId((current) => (current === itemId ? null : current))}
            onDrop={(event) => dropItem(event, itemId)}
            onDragEnd={endDrag}
            onKeyDown={(event) => onItemKeyDown(event, itemId)}
          >
            <GripVerticalIcon className={styles.dragHandle} aria-hidden />
            <span className={styles.orderIndex}>{index + 1}</span>
            <span className={styles.optionText}>{renderInlineText(item.text)}</span>
          </div>
        );
      })}

      <div className={styles.orderActions}>
        <Button
          type="button"
          className={styles.quizButton}
          disabled={answer != null}
          onClick={() => onSubmit(question)}
        >
          Check order
        </Button>
      </div>
    </div>
  );
}

function QuestionFallbackActions({ onSkip, onDontKnow }: { onSkip: () => void; onDontKnow: () => void }) {
  return (
    <div className={styles.fallbackActions}>
      <Button type="button" variant="secondary" className={styles.quizButton} onClick={onSkip}>
        Skip
      </Button>
      <Button
        type="button"
        variant="outline"
        className={`${styles.quizButton} ${styles.dontKnowButton}`}
        onClick={onDontKnow}
      >
        Don't know
      </Button>
    </div>
  );
}

function Feedback({
  question,
  answer,
  onNext,
  isLast,
}: {
  question: InterviewQuestion;
  answer: InterviewAnswer;
  onNext: () => void;
  isLast: boolean;
}) {
  return (
    <section className={styles.feedback} aria-live="polite">
      <div className={styles.feedbackHeader}>
        <h2
          className={styles.feedbackTitle}
          data-correct={answer.correct || undefined}
          data-wrong={!answer.correct || undefined}
        >
          {answer.correct ? <CheckCircleIcon aria-hidden /> : <XCircleIcon aria-hidden />}
          {answer.correct ? 'Correct' : 'Not quite'}
        </h2>
      </div>
      <FeedbackBody text={question.explanation} />
      <div className={styles.feedbackActions}>
        <Button type="button" className={styles.quizButton} onClick={onNext}>
          {isLast ? 'Finish session' : 'NEXT'}
        </Button>
      </div>
    </section>
  );
}

function FeedbackBody({ text }: { text: string }) {
  return (
    <div className={styles.feedbackBody}>
      {formatFeedbackParagraphs(text).map((paragraph) => (
        <p key={paragraph}>{renderInlineText(paragraph)}</p>
      ))}
    </div>
  );
}

function getQuestionSpokenText(question: InterviewQuestion): string {
  return question.stemSpoken ?? question.stem;
}

function getExplanationSpokenText(question: InterviewQuestion): string {
  return question.explanationSpoken ?? question.explanation;
}

interface InlineTextPart {
  code: boolean;
  key: string;
  text: string;
}

const INLINE_CODE_PATTERN =
  /(`[^`]+`|\b(?:await\s+)?expect\(.*?\)\.to[A-Za-z_$][\w$]*\([^)]*\)|\b(?:[a-z]+[A-Za-z0-9]*[A-Z][A-Za-z0-9]*|[a-z_$][\w$]*\.[A-Za-z_$][\w$]*(?:\([^)]*\))?)(?:\.[A-Za-z_$][\w$]*(?:\([^)]*\))?)*)/g;

const STEM_FOLLOW_UP_PATTERN =
  /([.?])\s+(?=(?:What|Which|Why|How|When|Where|Who|Order|Choose|Select|Identify|Name)\b)/;

function renderStemText(text: string) {
  return splitStemLines(text).map((line) => (
    <span key={line} className={styles.stemLine}>
      {renderInlineText(line)}
    </span>
  ));
}

function splitStemLines(text: string): string[] {
  const splitIndex = text.search(STEM_FOLLOW_UP_PATTERN);
  if (splitIndex < 0) return [text];

  const match = STEM_FOLLOW_UP_PATTERN.exec(text);
  if (!match?.[0]) return [text];

  const firstLineEnd = splitIndex + match[1].length;
  return [text.slice(0, firstLineEnd).trim(), text.slice(firstLineEnd).trim()].filter(Boolean);
}

function formatFeedbackParagraphs(text: string): string[] {
  return text
    .replace(/\bOption\s+([a-d])\b/g, (_, option: string) => `Option ${option.toUpperCase()}`)
    .replace(/\s+(?=Option\s+[A-D]\b)/g, '\n\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function renderInlineText(text: string) {
  return splitInlineCodeParts(text).map((part) =>
    part.code ? (
      <code key={part.key} className={styles.inlineCode}>
        {part.text}
      </code>
    ) : (
      part.text
    ),
  );
}

function splitInlineCodeParts(text: string): InlineTextPart[] {
  const parts: InlineTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_CODE_PATTERN)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({
        code: false,
        key: `text-${lastIndex}-${index}`,
        text: text.slice(lastIndex, index),
      });
    }
    parts.push({
      code: true,
      key: `code-${index}-${index + value.length}`,
      text: stripInlineCodeTicks(value),
    });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      code: false,
      key: `text-${lastIndex}-${text.length}`,
      text: text.slice(lastIndex),
    });
  }
  return parts;
}

function stripInlineCodeTicks(value: string): string {
  return value.startsWith('`') && value.endsWith('`') ? value.slice(1, -1) : value;
}

function OrderCorrections({
  question,
  answer,
}: {
  question: InterviewOrderQuestion;
  answer: Extract<InterviewAnswer, { type: 'order' }>;
}) {
  const itemById = new Map(question.items.map((item) => [item.id, item.text]));

  return (
    <Row gutterWidth={10} className={styles.orderCorrectionGrid}>
      <Col xs={12} lg={6}>
        <div className={styles.submittedOrderCorrections}>
          {answer.submittedOrder.map((id, index) => {
            const isCorrect = question.correctOrder[index] === id;

            return (
              <div
                key={id}
                className={styles.orderCorrectionItem}
                data-correct={isCorrect || undefined}
                data-wrong={!isCorrect || undefined}
              >
                <GripVerticalIcon className={styles.dragHandle} aria-hidden />
                <span className={styles.orderCorrectionMarker}>
                  {isCorrect ? index + 1 : <XCircleIcon aria-hidden />}
                </span>
                <span className={styles.optionText}>{itemById.get(id)}</span>
              </div>
            );
          })}
        </div>
      </Col>
      <Col xs={12} lg={6}>
        <div className={styles.correctOrderCorrections}>
          {question.correctOrder.map((id) => (
            <div key={id} className={styles.orderCorrectionItem} data-correct>
              <span className={styles.optionText}>{itemById.get(id)}</span>
            </div>
          ))}
        </div>
      </Col>
    </Row>
  );
}

function SummaryView({
  questions,
  answers,
  score,
  answeredCount,
  storage,
  onRetryMissed,
  onNewSession,
}: {
  questions: InterviewQuestion[];
  answers: Record<string, InterviewAnswer>;
  score: number;
  answeredCount: number;
  storage: InterviewQuizStorage;
  onRetryMissed: () => void;
  onNewSession: () => void;
}) {
  const missedQuestions = questions.filter(
    (question) => answers[question.id] && !answers[question.id].correct,
  );
  const domainBreakdown = INTERVIEW_DOMAIN_META.map((domain) => {
    const domainQuestions = questions.filter((question) => question.domain === domain.id);
    const correct = domainQuestions.filter((question) => answers[question.id]?.correct).length;
    return { domain, total: domainQuestions.length, correct };
  }).filter((item) => item.total > 0);

  return (
    <div className={styles.summaryStack}>
      <Card>
        <CardHeader>
          <CardTitle>Session summary</CardTitle>
          <CardDescription>
            {score} correct from {answeredCount} answered.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Row gutterWidth={12}>
            {domainBreakdown.map(({ domain, total, correct }) => {
              const lifetime = storage.domainAccuracy[domain.id];
              return (
                <Col key={domain.id} xs={12} md={6} xl={3}>
                  <div className={styles.summaryMetric}>
                    <span>{domain.title}</span>
                    <strong>
                      {correct} / {total}
                    </strong>
                    <small>
                      {lifetime && lifetime.attempts > 0
                        ? `${Math.round((lifetime.correct / lifetime.attempts) * 100)}% lifetime`
                        : 'no lifetime attempts'}
                    </small>
                  </div>
                </Col>
              );
            })}
          </Row>
          <div className={styles.summaryActions}>
            <Button type="button" variant="outline" className={styles.quizButton} onClick={onNewSession}>
              New session
            </Button>
            <Button
              type="button"
              className={styles.quizButton}
              disabled={missedQuestions.length === 0}
              onClick={onRetryMissed}
            >
              <RotateCcwIcon aria-hidden />
              Retry missed only
            </Button>
          </div>
        </CardContent>
      </Card>

      {missedQuestions.length > 0 ? (
        <section className={styles.missedList}>
          <h2>Missed questions</h2>
          {missedQuestions.map((question) => (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className={styles.missedTitle}>{renderInlineText(question.stem)}</CardTitle>
                <CardDescription>
                  {question.domain} · {question.section} · difficulty {question.difficulty}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>{question.explanation}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const displayLang = normalizeDisplayLanguage(lang);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHighlightedHtml(null);

    async function highlightCode() {
      try {
        const res = await api.vault['code-highlight'].$post({
          json: { code: content, language: displayLang },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setHighlightedHtml(data.html);
      } catch {
        if (!cancelled) setHighlightedHtml(null);
      }
    }

    void highlightCode();

    return () => {
      cancelled = true;
    };
  }, [content, displayLang]);

  return (
    <figure className={styles.codeBlock}>
      <figcaption>{displayLang}</figcaption>
      {highlightedHtml ? (
        <div className={styles.highlightedCode} dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      ) : (
        <pre>
          <code>{content}</code>
        </pre>
      )}
    </figure>
  );
}

function normalizeDisplayLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  if (normalized === 'jsx' || normalized === 'javascriptreact') return 'tsx';
  if (normalized === 'js') return 'javascript';
  if (normalized === 'ts') return 'typescript';
  return normalized || 'text';
}

function parseSessionCount(value: string): InterviewSessionCount {
  if (value === '5' || value === '10' || value === '20') return Number(value) as InterviewSessionCount;
  return 'all';
}

function parseDifficulty(value: string): InterviewDifficultyFilter {
  if (value === '1' || value === '2' || value === '3') return Number(value) as 1 | 2 | 3;
  return 'all';
}
