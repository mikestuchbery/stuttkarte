import { motion } from 'framer-motion';
import { Train } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="max-w-md w-full space-y-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.8,
            ease: "easeOut"
          }}
          className="flex justify-center"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-orange-100 rounded-full blur-2xl opacity-50 animate-pulse" />
            <div className="relative bg-orange-500 p-6 rounded-3xl shadow-2xl shadow-orange-200">
              <Train className="h-12 w-12 text-white" />
            </div>
          </div>
        </motion.div>

        <div className="space-y-6">
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-black text-zinc-900 tracking-tight"
          >
            Stutt<span className="text-orange-500">karte</span>
          </motion.h1>

          <div className="space-y-4">
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xl font-medium text-zinc-800"
            >
              Stuttgart is a beautiful city.
            </motion.p>
            
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-zinc-500 font-medium"
            >
              Pity they make it hard to get around.
            </motion.p>

            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 2.0 }}
              className="text-zinc-600 leading-relaxed"
            >
              Stuttkarte helps you work out which tickets to buy, and gets you on your way.
            </motion.p>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.8 }}
          className="pt-8"
        >
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 1, 
                  delay: i * 0.2 
                }}
                className="h-1.5 w-1.5 rounded-full bg-orange-500"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
