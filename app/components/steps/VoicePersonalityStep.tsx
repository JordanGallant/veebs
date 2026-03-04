"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  Mic,
  Square,
  Play,
  Pause,
  Check,
  Sparkles,
  User,
  Heart,
  Briefcase,
  Zap,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "../Button";
import { Container } from "../Container";

interface VoicePersonalityStepProps {
  onComplete: (voiceRecording: Blob, personalityPrompt: string) => void;
}

interface Question {
  id: string;
  icon: typeof User;
  title: string;
  prompt: string;
}

const QUESTIONS: Question[] = [
  {
    id: "role",
    icon: User,
    title: "Who are you?",
    prompt: "Tell us a bit about yourself! What's your name and what do you do?",
  },
  {
    id: "personality",
    icon: Heart,
    title: "Your vibe?",
    prompt: "How would your friends describe your personality?",
  },
  {
    id: "twin-role",
    icon: Briefcase,
    title: "Twin's job?",
    prompt: "What should your cyber twin help you with?",
  },
  {
    id: "style",
    icon: Zap,
    title: "Your style?",
    prompt: "Fun or serious? Chill or energetic? Tell us your twin's vibe!",
  },
];

interface Recording {
  blob: Blob;
  url: string;
  questionId?: string;
  duration: number;
}

// Staggered entrance variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 30,
    },
  },
};

export function VoicePersonalityStep({ onComplete }: VoicePersonalityStepProps) {
  const [phase, setPhase] = useState<"questions" | "review">("questions");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordings.forEach((r) => URL.revokeObjectURL(r.url));
    };
  }, [recordings]);

  const startRecording = async (questionId?: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordings((prev) => [
          ...prev,
          { blob, url, questionId, duration: recordingTime },
        ]);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Please allow microphone access!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleQuestionRecord = (questionId: string) => {
    if (isRecording) {
      stopRecording();
      setTimeout(() => {
        const nextIndex = QUESTIONS.findIndex((q) => q.id === questionId) + 1;
        if (nextIndex < QUESTIONS.length) {
          setCurrentQuestionIndex(nextIndex);
        }
      }, 300);
    } else {
      startRecording(questionId);
    }
  };

  const togglePlayback = (url: string) => {
    const audio = audioRefs.current.get(url);
    if (!audio) return;

    if (isPlaying === url) {
      audio.pause();
      setIsPlaying(null);
    } else {
      audioRefs.current.forEach((a, key) => {
        if (key !== url) {
          a.pause();
          a.currentTime = 0;
        }
      });
      audio.play();
      setIsPlaying(url);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRecordingForQuestion = (questionId: string) => {
    return recordings.find((r) => r.questionId === questionId);
  };

  const allQuestionsAnswered = QUESTIONS.every(
    (q) => getRecordingForQuestion(q.id)
  );

  const generatePersonalityPrompt = () => {
    return `A digital twin based on ${recordings.length} voice samples, designed to be helpful and authentic to the user's personality.`;
  };

  const handleComplete = () => {
    const introRecording = recordings.find((r) => !r.questionId);
    if (introRecording) {
      onComplete(introRecording.blob, generatePersonalityPrompt());
    }
  };

  const handleReset = () => {
    recordings.forEach((r) => URL.revokeObjectURL(r.url));
    setRecordings([]);
    setCurrentQuestionIndex(0);
    setPhase("questions");
  };

  // QUESTIONS PHASE - Bento Grid Layout
  if (phase === "questions") {
    return (
      <div className="min-h-screen flex flex-col items-center px-6 py-12 bg-zinc-50">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                delay: 0.2, 
                type: "spring" as const,
                stiffness: 400,
                damping: 30,
              }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-950 text-zinc-50 mb-6"
            >
              <Mic size={28} />
            </motion.div>
            <h2 className="text-3xl font-semibold text-zinc-950 mb-3">
              Voice Your Personality
            </h2>
            <p className="text-zinc-500 max-w-md mx-auto">
              Answer four quick questions to help us understand your unique voice and style
            </p>
          </motion.div>

          {/* Bento Grid - 2x2 on desktop, 1 column on mobile */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
          >
            {QUESTIONS.map((question, index) => {
              const recording = getRecordingForQuestion(question.id);
              const isCurrentQuestion = index === currentQuestionIndex;
              const isCompleted = !!recording;
              const isRecordingThis = isRecording && isCurrentQuestion;
              const Icon = question.icon;

              return (
                <motion.div
                  key={question.id}
                  variants={itemVariants}
                  onHoverStart={() => setHoveredCard(question.id)}
                  onHoverEnd={() => setHoveredCard(null)}
                  className={`
                    relative overflow-hidden rounded-3xl p-6 transition-all duration-300
                    ${isCompleted
                      ? "bg-emerald-50 border-2 border-emerald-200"
                      : isCurrentQuestion
                      ? "bg-white border-2 border-zinc-200 hover:border-blue-400"
                      : "bg-zinc-100 border-2 border-transparent opacity-60"
                    }
                  `}
                  style={{
                    minHeight: "180px",
                  }}
                >
                  {/* Background ambient animation for active card */}
                  {isCurrentQuestion && !isCompleted && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"
                      animate={{
                        opacity: [0.3, 0.6, 0.3],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}

                  {/* Card Content */}
                  <div className="relative z-10 h-full flex flex-col">
                    {/* Icon and Title Row */}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={`
                          w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
                          ${isCompleted
                            ? "bg-emerald-500 text-white"
                            : isCurrentQuestion
                            ? "bg-zinc-950 text-zinc-50"
                            : "bg-zinc-300 text-zinc-500"
                          }
                        `}
                      >
                        <Icon size={22} />
                      </div>

                      {/* Status Indicator */}
                      <AnimatePresence mode="wait">
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{
                              type: "spring" as const,
                              stiffness: 400,
                              damping: 30,
                            }}
                            className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center"
                          >
                            <Check size={16} className="text-white" />
                          </motion.div>
                        ) : isRecordingThis ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-full"
                          >
                            <motion.div
                              className="w-2 h-2 rounded-full bg-rose-500"
                              animate={{
                                scale: [1, 1.3, 1],
                                opacity: [1, 0.7, 1],
                              }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            />
                            <span className="text-xs font-mono text-rose-600 font-medium">
                              {formatTime(recordingTime)}
                            </span>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    {/* Title */}
                    <h3
                      className={`text-lg font-semibold mb-2 ${
                        isCompleted
                          ? "text-emerald-900"
                          : isCurrentQuestion
                          ? "text-zinc-950"
                          : "text-zinc-400"
                      }`}
                    >
                      {question.title}
                    </h3>

                    {/* Prompt */}
                    <p
                      className={`text-sm mb-4 flex-grow ${
                        isCompleted
                          ? "text-emerald-600"
                          : isCurrentQuestion
                          ? "text-zinc-500"
                          : "text-zinc-400"
                      }`}
                    >
                      {question.prompt}
                    </p>

                    {/* Action Area */}
                    <div className="mt-auto">
                      {isCompleted ? (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => recording && togglePlayback(recording.url)}
                          className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
                        >
                          {isPlaying === recording?.url ? (
                            <>
                              <Pause size={16} />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play size={16} />
                              <span>Play Recording ({formatTime(recording.duration)})</span>
                            </>
                          )}
                          {recording && (
                            <audio
                              ref={(el) => {
                                if (el) audioRefs.current.set(recording.url, el);
                              }}
                              src={recording.url}
                              onEnded={handleAudioEnded}
                            />
                          )}
                        </motion.button>
                      ) : isRecordingThis ? (
                        <Button
                          variant="primary"
                          onClick={() => handleQuestionRecord(question.id)}
                          className="w-full bg-rose-500 hover:bg-rose-600 text-white border-none"
                        >
                          <Square size={16} />
                          Stop Recording
                        </Button>
                      ) : isCurrentQuestion ? (
                        <Button
                          variant="primary"
                          onClick={() => handleQuestionRecord(question.id)}
                          className="w-full"
                        >
                          <Mic size={16} />
                          Record Answer
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <div className="w-4 h-4 rounded-full border-2 border-zinc-300" />
                          <span>Locked</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover glow effect */}
                  <AnimatePresence>
                    {hoveredCard === question.id && isCurrentQuestion && !isCompleted && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 rounded-3xl ring-2 ring-blue-400/30 ring-offset-2 ring-offset-zinc-50"
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Progress & Navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center gap-6"
          >
            {/* Progress dots */}
            <div className="flex items-center gap-2">
              {QUESTIONS.map((q, index) => {
                const isCompleted = !!getRecordingForQuestion(q.id);
                const isCurrent = index === currentQuestionIndex;

                return (
                  <motion.div
                    key={q.id}
                    className={`
                      h-2 rounded-full transition-all duration-300
                      ${isCompleted
                        ? "w-8 bg-emerald-500"
                        : isCurrent
                        ? "w-8 bg-blue-500"
                        : "w-2 bg-zinc-300"
                      }
                    `}
                    layout
                  />
                );
              })}
            </div>

            {/* Continue Button */}
            <AnimatePresence>
              {allQuestionsAnswered && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{
                    type: "spring" as const,
                    stiffness: 400,
                    damping: 30,
                  }}
                >
                  <Button
                    variant="primary"
                    size="large"
                    onClick={() => setPhase("review")}
                    rightIcon={
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowRight size={20} />
                      </motion.span>
                    }
                  >
                    Review & Create
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    );
  }

  // REVIEW PHASE - Summary Grid
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-zinc-50">
      <div className="w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              delay: 0.2, 
              type: "spring" as const,
              stiffness: 200,
            }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 mb-8"
          >
            <Check size={48} strokeWidth={3} />
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-semibold text-zinc-950 mb-4"
          >
            Ready to Create!
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-zinc-500 mb-10 max-w-md mx-auto"
          >
            We&apos;ve captured your voice and personality from {recordings.length} recordings
          </motion.p>

          {/* Summary Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10"
          >
            {QUESTIONS.map((q) => {
              const recording = getRecordingForQuestion(q.id);
              const Icon = q.icon;

              return (
                <motion.div
                  key={q.id}
                  variants={itemVariants}
                  className={`
                    relative p-4 rounded-2xl text-left overflow-hidden
                    ${recording ? "bg-white border border-zinc-200" : "bg-zinc-100"}
                  `}
                >
                  {/* Decorative waveform */}
                  {recording && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-10">
                      <svg width="60" height="40" viewBox="0 0 60 40">
                        {[...Array(8)].map((_, i) => (
                          <motion.rect
                            key={i}
                            x={i * 8}
                            y={20 - Math.random() * 15}
                            width="4"
                            rx="2"
                            fill="currentColor"
                            className="text-zinc-950"
                            initial={{ height: 4 }}
                            animate={{
                              height: [4, 20 + Math.random() * 15, 4],
                              y: [18, 20 - (20 + Math.random() * 15) / 2, 18],
                            }}
                            transition={{
                              duration: 0.8 + Math.random() * 0.5,
                              repeat: Infinity,
                              delay: i * 0.1,
                            }}
                          />
                        ))}
                      </svg>
                    </div>
                  )}

                  <div
                    className={`
                      w-8 h-8 rounded-lg flex items-center justify-center mb-3
                      ${recording ? "bg-emerald-100 text-emerald-600" : "bg-zinc-200 text-zinc-400"}
                    `}
                  >
                    <Icon size={16} />
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      recording ? "text-zinc-900" : "text-zinc-400"
                    }`}
                  >
                    {q.title}
                  </p>
                  {recording && (
                    <p className="text-xs text-zinc-400 mt-1 font-mono">
                      {formatTime(recording.duration)}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          {/* Create Button with Shimmer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col items-center gap-4"
          >
            <Button
              variant="primary"
              size="large"
              onClick={handleComplete}
              className="relative overflow-hidden min-w-[240px]"
              leftIcon={<Sparkles size={20} className="relative z-10" />}
            >
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1,
                  ease: "linear",
                }}
              />
              <span className="relative z-10">Create My Cyber Twin</span>
            </Button>

            <motion.button
              onClick={handleReset}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <RotateCcw size={14} />
              Start Over
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
