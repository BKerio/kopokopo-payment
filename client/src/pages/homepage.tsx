import { useNavigate } from "react-router-dom";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import mpesaLogo from "@/assets/mpesa.png";
import kopokopoLogo from "@/assets/kopokop.png";

type Provider = {
  name: string;
  description: string;
  logo: string;
  tags: string[];
  payHref: string;
  transactionsHref: string;
};

const providers: Provider[] = [
  {
    name: "M-Pesa Daraja",
    description: "Direct Safaricom STK Push API",
    logo: mpesaLogo,
    tags: ["STK Push", "Express Checkout"],
    payHref: "/pay/mpesa",
    transactionsHref: "/transactions",
  },
  {
    name: "KopoKopo",
    description: "M-Pesa Collection API",
    logo: kopokopoLogo,
    tags: ["Collections", "Webhooks", "Sandbox"],
    payHref: "/pay/kopokopo",
    transactionsHref: "/transactions/kopokopo",
  },
];

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="w-full max-w-4xl mx-auto flex justify-end pt-2">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-4xl mx-auto py-10">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight">SmartPOS</h1>
          <p className="mt-2 text-muted-foreground">
            Choose your preferred payment provider
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="rounded-xl border border-border bg-card p-6 flex flex-col"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 shrink-0 rounded-lg border border-border bg-background flex items-center justify-center">
                  <img
                    src={provider.logo}
                    alt={provider.name}
                    className="w-9 h-9 object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{provider.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {provider.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {provider.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-auto">
                <Button
                  onClick={() => navigate(provider.payHref)}
                  className="group"
                >
                  Pay Now
                  <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(provider.transactionsHref)}
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  Transactions
                </Button>
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
            Secure payment platform
          </div>
        </footer>
      </div>
    </div>
  );
};

export default HomePage;
