import { useState, useEffect } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface CountdownTimerProps {
  targetDate: Date;
  onComplete?: () => void;
}

const CountdownTimer = ({ targetDate, onComplete }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      
      if (difference <= 0) {
        setIsComplete(true);
        onComplete?.();
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  if (isComplete) {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <span className="w-3 h-3 bg-neon-pink rounded-full" />
        <span className="font-display text-xl md:text-2xl text-neon-pink tracking-wider">
          DROP IS LIVE — LIMITED STOCK
        </span>
      </div>
    );
  }

  const timeBlocks = [
    { value: timeLeft.days, label: "DAYS" },
    { value: timeLeft.hours, label: "HRS" },
    { value: timeLeft.minutes, label: "MIN" },
    { value: timeLeft.seconds, label: "SEC" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Next Drop In
      </span>
      <div className="flex gap-3 md:gap-4">
        {timeBlocks.map((block, index) => (
          <div key={block.label} className="flex items-center gap-3 md:gap-4">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-lg" />
                <div className="relative bg-secondary border border-primary/30 rounded-lg px-3 py-2 md:px-4 md:py-3 min-w-[60px] md:min-w-[80px]">
                  <span className="font-display text-3xl md:text-5xl text-primary text-neon-glow">
                    {String(block.value).padStart(2, "0")}
                  </span>
                </div>
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground mt-2 tracking-widest">
                {block.label}
              </span>
            </div>
            {index < timeBlocks.length - 1 && (
              <span className="font-display text-2xl md:text-4xl text-primary/50 -mt-6">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CountdownTimer;
