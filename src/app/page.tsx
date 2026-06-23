'use client';

import { motion } from 'framer-motion';
import { Mic, ArrowRight, Activity, Brain, Play } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
    },
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--bg-primary)]">
      <Navbar />
      <main className="flex-1">
        {/* Dynamic Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute -left-[10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[var(--accent-cyan)] opacity-20 blur-[120px]" />
          <div className="absolute -right-[10%] top-[40%] h-[600px] w-[600px] rounded-full bg-[var(--accent-purple)] opacity-20 blur-[150px]" />
          <div className="absolute left-[20%] top-[80%] h-[400px] w-[400px] rounded-full bg-[var(--accent-cyan)] opacity-10 blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center px-6 py-32 text-center md:px-12 lg:px-24 lg:py-48">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex max-w-4xl flex-col items-center"
          >
            {/* Badge */}
            <motion.div variants={itemVariants} className="mb-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-glow)] bg-[var(--bg-glass-light)] px-4 py-2 text-sm font-medium text-[var(--accent-cyan)] backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-cyan)] opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent-cyan)]"></span>
                </span>
                Powered by OpenRouter + Gemini 2.5 Flash
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="mb-6 text-5xl font-extrabold tracking-tight text-white md:text-7xl"
            >
              Present Naturally with{' '}
              <span className="bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] bg-clip-text text-transparent">
                AI Vision
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={itemVariants}
              className="mb-10 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl"
            >
              SyncSpeak listens to your voice and intelligently scrolls your script. Never lose your place again. It's like having a teleprompter that actually understands you.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row">
              <Link href="/dashboard">
                <Button size="lg" className="group text-lg">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="secondary" size="lg" className="text-lg">
                  <Play className="mr-2 h-5 w-5" />
                  Try a Demo Session
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Features Section */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-1 gap-8 md:grid-cols-3"
          >
            <GlassCard className="flex flex-col items-center p-8 text-center" hover glow>
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent-cyan)] to-[var(--accent-purple)] shadow-[var(--glow-strong)]">
                <Mic className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-white">Voice Tracking</h3>
              <p className="text-[var(--text-muted)]">
                Automatically scrolls your text by listening to what you say. Pauses when you pause, and skips ahead if you do.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col items-center p-8 text-center" hover glow>
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent-cyan)] to-[var(--accent-purple)] shadow-[var(--glow-strong)]">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-white">Smart Recovery</h3>
              <p className="text-[var(--text-muted)]">
                Improvise freely. If you drift off-script, the AI suggests transition phrases to get you smoothly back on track.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col items-center p-8 text-center" hover glow>
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent-cyan)] to-[var(--accent-purple)] shadow-[var(--glow-strong)]">
                <Activity className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-white">Coaching Insights</h3>
              <p className="text-[var(--text-muted)]">
                Get real-time visual cues on when to emphasize points, slow down, or take a breath, generated by AI.
              </p>
            </GlassCard>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
