import { useState, useEffect } from "react";
import { Eye } from "lucide-react";

interface ViewerCounterProps {
  productId: number;
}

const ViewerCounter = ({ productId }: ViewerCounterProps) => {
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    // Simulate random viewer count between 5-25
    const baseViewers = Math.floor(Math.random() * 20) + 5;
    setViewers(baseViewers);

    // Simulate fluctuating viewers
    const interval = setInterval(() => {
      setViewers((prev) => {
        const change = Math.floor(Math.random() * 5) - 2;
        return Math.max(3, Math.min(30, prev + change));
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [productId]);

  return (
    <div className="flex items-center gap-2 text-neon-pink animate-glow-pulse">
      <Eye className="h-4 w-4" />
      <span className="text-sm font-medium">
        {viewers} people are viewing this right now
      </span>
    </div>
  );
};

export default ViewerCounter;
