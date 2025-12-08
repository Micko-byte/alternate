import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Phone, Lock, CheckCircle, Loader2 } from "lucide-react";

interface MobileMoneyCheckoutProps {
  productName: string;
  price: string;
  size: string | null;
}

type CheckoutStep = "phone" | "processing" | "success";

const MobileMoneyCheckout = ({ productName, price, size }: MobileMoneyCheckoutProps) => {
  const [step, setStep] = useState<CheckoutStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const { toast } = useToast();

  const handleSubmitPhone = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!size) {
      toast({
        title: "Select a size",
        description: "Please select a size before checkout",
        variant: "destructive",
      });
      return;
    }

    if (phoneNumber.length < 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setStep("processing");
    
    // Simulate PIN entry on phone
    toast({
      title: "Check your phone",
      description: "Enter your Mobile Money PIN to complete payment",
    });

    // Simulate successful payment after delay
    setTimeout(() => {
      setStep("success");
    }, 4000);
  };

  if (step === "success") {
    return (
      <div className="bg-card border border-primary/30 rounded-lg p-6 text-center space-y-4 glow-neon">
        <CheckCircle className="h-16 w-16 text-primary mx-auto animate-glow-pulse" />
        <h3 className="font-display text-xl text-foreground">Payment Successful!</h3>
        <p className="text-muted-foreground text-sm">
          Your {productName} (Size: {size}) is on its way!
        </p>
        <p className="text-xs text-muted-foreground">
          Confirmation sent to {phoneNumber}
        </p>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="bg-card border border-neon-yellow/30 rounded-lg p-6 text-center space-y-4">
        <Loader2 className="h-12 w-12 text-neon-yellow mx-auto animate-spin" />
        <h3 className="font-display text-lg text-foreground">Waiting for PIN...</h3>
        <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Lock className="h-4 w-4" />
          Enter your PIN on your phone
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitPhone} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Mobile Money Number
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="tel"
            placeholder="0700 000 000"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="pl-10 bg-card border-border focus:border-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          MTN or Airtel Mobile Money
        </p>
      </div>
      
      <Button type="submit" variant="urgent" size="xl" className="w-full">
        Pay {price}
      </Button>
      
      <p className="text-xs text-center text-muted-foreground">
        You'll enter your PIN on your phone to confirm
      </p>
    </form>
  );
};

export default MobileMoneyCheckout;
