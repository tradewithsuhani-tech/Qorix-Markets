import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';

export const SCENE_DURATIONS = {
  intro: 20000,
  onboarding: 30000,
  dashboard: 40000,
  promo: 35000,
  notifs: 35000,
  outro: 20000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: Scene1,
  onboarding: Scene2,
  dashboard: Scene3,
  promo: Scene4,
  notifs: Scene5,
  outro: Scene6,
};

interface VideoTemplateProps {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
}

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: VideoTemplateProps = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-bg-dark font-body text-text-primary">

      {/* Persistent Background Layer */}
      <div className="absolute inset-0 z-0">
        <video
          src={`${import.meta.env.BASE_URL}videos/hero-background.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full opacity-20 blur-[80px]"
          style={{ background: 'radial-gradient(circle, var(--color-accent), transparent)' }}
          animate={{
            x: ['-20%', '40%', '-10%'],
            y: ['0%', '30%', '10%'],
            scale: [1, 1.2, 0.9],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[50vw] h-[50vw] rounded-full opacity-15 blur-[80px] right-0 bottom-0"
          style={{ background: 'radial-gradient(circle, var(--color-success), transparent)' }}
          animate={{
            x: ['10%', '-30%', '0%'],
            y: ['10%', '-20%', '5%'],
            scale: [1, 1.1, 0.8],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Subtle noise overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Grid Pattern overlay */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '4vw 4vw',
        }}
        animate={{
          y: ['0vw', '4vw'],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />

      <AnimatePresence initial={false} mode="wait">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
