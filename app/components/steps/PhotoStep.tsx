"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, Check, RotateCcw, X, User } from "lucide-react";

interface PhotoStepProps {
  onComplete: (photo: string) => void;
}

const springTransition = {
  type: "spring" as const,
  stiffness: 100,
  damping: 20,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
};

export function PhotoStep({ onComplete }: PhotoStepProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const photoData = canvas.toDataURL("image/jpeg", 0.9);
    setPreview(photoData);
    stopCamera();
  };

  const handleFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRetake = () => {
    setPreview(null);
    startCamera();
  };

  const handleContinue = () => {
    if (preview) onComplete(preview);
  };

  const handleCancel = () => {
    stopCamera();
    setPreview(null);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-zinc-50 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-600/5 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-[100dvh] flex items-center">
        <div className="w-full px-6 sm:px-12 lg:px-16 xl:px-24 py-12">
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-12 lg:gap-16 items-center max-w-6xl mx-auto"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Left side - Text content */}
            <div className="order-2 lg:order-1">
              <motion.div
                variants={itemVariants}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200/50 text-xs font-medium text-zinc-600 tracking-wide uppercase mb-6"
              >
                <Camera size={12} className="text-blue-600" />
                Step 1 of 3
              </motion.div>

              <motion.h2
                variants={itemVariants}
                className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-zinc-950 tracking-tight leading-tight mb-4"
              >
                Take a selfie
              </motion.h2>

              <motion.p
                variants={itemVariants}
                className="text-base text-zinc-600 leading-relaxed max-w-md mb-8"
              >
                A clear photo of your face helps us create an accurate digital twin. 
                Make sure you are in good lighting.
              </motion.p>

              {/* Feature list */}
              <motion.div variants={itemVariants} className="space-y-3">
                {[
                  "Position your face in the center",
                  "Ensure good lighting on your face",
                  "Keep a neutral expression",
                ].map((tip, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-3 text-sm text-zinc-600"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...springTransition, delay: 0.5 + index * 0.1 }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    {tip}
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Right side - Camera interface */}
            <motion.div variants={itemVariants} className="order-1 lg:order-2">
              <AnimatePresence mode="wait">
                {!preview && !isStreaming && (
                  <motion.div
                    key="initial"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                    className="relative"
                  >
                    {/* Glass morphism camera frame */}
                    <div
                      className={`relative aspect-square max-w-md mx-auto rounded-[2rem] border transition-all duration-300 ${
                        isDragging
                          ? "border-blue-500 bg-blue-50/50 border-dashed"
                          : "border-zinc-200/60 bg-white/50"
                      }`}
                      style={{
                        backdropFilter: "blur(20px)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 20px 40px -15px rgba(0,0,0,0.08)",
                      }}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {/* Camera button center */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                        <motion.button
                          onClick={startCamera}
                          className="relative w-24 h-24 rounded-full bg-zinc-950 flex items-center justify-center group"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={springTransition}
                        >
                          {/* Pulse ring */}
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-zinc-950"
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{ scale: 1.3, opacity: 0 }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: "easeOut",
                            }}
                          />
                          <Camera size={32} className="text-zinc-50" />
                        </motion.button>
                        <p className="text-sm text-zinc-500 font-medium">
                          Tap to open camera
                        </p>
                      </div>

                      {/* Upload area at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <motion.button
                          onClick={() => inputRef.current?.click()}
                          className="w-full py-3 rounded-xl border border-zinc-200/80 bg-white/80 text-zinc-700 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white transition-colors"
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          transition={springTransition}
                        >
                          <Upload size={16} />
                          Or upload a photo
                        </motion.button>
                        <input
                          ref={inputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleChange}
                          className="hidden"
                        />
                      </div>

                      {/* Corner decorations */}
                      <div className="absolute top-6 left-6 w-8 h-8 border-l-2 border-t-2 border-zinc-300/50 rounded-tl-lg" />
                      <div className="absolute top-6 right-6 w-8 h-8 border-r-2 border-t-2 border-zinc-300/50 rounded-tr-lg" />
                      <div className="absolute bottom-6 left-6 w-8 h-8 border-l-2 border-b-2 border-zinc-300/50 rounded-bl-lg" />
                      <div className="absolute bottom-6 right-6 w-8 h-8 border-r-2 border-b-2 border-zinc-300/50 rounded-br-lg" />
                    </div>

                    {/* Drag overlay */}
                    <AnimatePresence>
                      {isDragging && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                            Drop photo here
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {isStreaming && (
                  <motion.div
                    key="streaming"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                    className="relative"
                  >
                    {/* Camera preview with glass frame */}
                    <div
                      className="relative aspect-square max-w-md mx-auto rounded-[2rem] overflow-hidden border border-zinc-200/60"
                      style={{
                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
                      }}
                    >
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: "scaleX(-1)" }}
                      />

                      {/* Recording indicator */}
                      <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
                        <motion.div
                          className="w-2 h-2 rounded-full bg-red-500"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <span className="text-white text-xs font-medium">LIVE</span>
                      </div>

                      {/* Face guide overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border-2 border-white/30" />
                      </div>
                    </div>

                    {/* Capture button */}
                    <div className="flex flex-col items-center gap-4 mt-8">
                      <motion.button
                        onClick={takePhoto}
                        className="relative w-20 h-20 rounded-full bg-white border-4 border-zinc-950 flex items-center justify-center"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={springTransition}
                      >
                        <div className="w-14 h-14 rounded-full bg-zinc-950" />
                      </motion.button>

                      <motion.button
                        onClick={handleCancel}
                        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 transition-colors text-sm font-medium"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <X size={16} />
                        Cancel
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {preview && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                    className="relative"
                  >
                    {/* Preview with glass frame */}
                    <div
                      className="relative aspect-square max-w-md mx-auto rounded-[2rem] overflow-hidden border border-zinc-200/60"
                      style={{
                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
                      }}
                    >
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />

                      {/* Success badge */}
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, ...springTransition }}
                        className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/90 backdrop-blur-sm"
                      >
                        <Check size={14} className="text-white" />
                        <span className="text-white text-xs font-medium">Captured</span>
                      </motion.div>
                    </div>

                    {/* Action buttons */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, ...springTransition }}
                      className="flex items-center justify-center gap-4 mt-8"
                    >
                      <motion.button
                        onClick={handleRetake}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-zinc-200 bg-white text-zinc-700 text-sm font-medium hover:bg-zinc-50 transition-colors"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        transition={springTransition}
                      >
                        <RotateCcw size={16} />
                        Retake
                      </motion.button>

                      <motion.button
                        onClick={handleContinue}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-950 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        transition={springTransition}
                      >
                        <Check size={16} />
                        Looks Good
                      </motion.button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hidden canvas for photo capture */}
              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
