import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 400);
    }, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "#0A0A0A",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}
        >
          {/* Glow rings */}
          {[280, 360, 440].map((size, i) => (
            <motion.div
              key={size}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 1.2, delay: 0.4 + i * 0.1, ease: "easeOut" }}
              style={{
                position: "absolute",
                width: size, height: size,
                borderRadius: "50%",
                border: "1px solid #ADFF2F",
                opacity: 0,
              }}
            />
          ))}

          {/* Badge */}
          <motion.img
            src="/logo-icon.png"
            alt="SwapStrat"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
            style={{ width: 160, height: 160, objectFit: "contain", marginBottom: 32 }}
          />

          {/* Wordmark */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 900,
              fontSize: 28,
              color: "#ADFF2F",
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            SWAPSTRAT
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.7 }}
            style={{ color: "#666", fontSize: 13, fontFamily: "Inter, sans-serif" }}
          >
            Trade Smarter.
          </motion.p>

          {/* Pulsing dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            style={{ display: "flex", gap: 8, marginTop: 48 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                style={{ width: 8, height: 8, borderRadius: "50%", background: "#ADFF2F" }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
