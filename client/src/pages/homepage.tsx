import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  FileText,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

// Replace these with your actual logo paths
import mpesaLogo from "@/assets/mpesa.png";
import kopokopoLogo from "@/assets/kopokop.png";

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">

        {/* Header */}
        <div className="text-center mb-10">


          <p className="mt-3 text-gray-500">
            Choose your preferred payment providerhjkl
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-8">

          {/* ================== M-PESA ================== */}

          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8 hover:shadow-2xl transition-all duration-300">

            <div className="flex justify-between items-start mb-8">

              <div className="flex items-center gap-4">

                <div className="w-16 h-16 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center">
                  <img
                    src={mpesaLogo}
                    alt="M-Pesa"
                    className="w-11 h-11 object-contain"
                  />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    M-Pesa Daraja
                  </h2>

                  <p className="text-gray-500 mt-1">
                    Direct Safaricom STK Push API
                  </p>
                </div>

              </div>

            </div>

            <div className="flex flex-wrap gap-2 mb-8">

              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm">
                STK Push
              </span>

              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm">
                Express Checkout
              </span>


            </div>

            <div className="grid grid-cols-2 gap-4">

              <button
                onClick={() => navigate("/pay/mpesa")}
                className="group flex items-center justify-center gap-2 bg-black hover:bg-gray-900 text-white rounded-2xl py-3 font-semibold transition-all"
              >
                Pay Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => navigate("/transactions")}
                className="flex items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 py-3 font-semibold transition-all"
              >
                <FileText className="w-4 h-4" />
                Transactions
              </button>

            </div>

          </div>

          {/* ================== KOPOKOPO ================== */}

          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8 hover:shadow-2xl transition-all duration-300 relative overflow-hidden">

            <div className="absolute top-5 right-5">

              <div className="flex items-center gap-2 bg-orange-100 px-3 py-1 rounded-full">

                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>


              </div>

            </div>

            <div className="flex items-center gap-4 mb-8">

              <div className="w-16 h-16 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center">
                <img
                  src={kopokopoLogo}
                  alt="KopoKopo"
                  className="w-11 h-11 object-contain"
                />
              </div>

              <div>

                <h2 className="text-2xl font-bold text-gray-900">
                  KopoKopo
                </h2>

                <p className="text-gray-500 mt-1">
                  M-Pesa Collection API
                </p>

              </div>

            </div>

            <div className="flex flex-wrap gap-2 mb-8">

              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm">
                Collections
              </span>

              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm">
                Webhooks
              </span>

              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm">
                Sandbox
              </span>

            </div>

            <div className="grid grid-cols-2 gap-4">

              <button
                onClick={() => navigate("/pay/kopokopo")}
                className="group flex items-center justify-center gap-2 bg-black hover:bg-gray-900 text-white rounded-2xl py-3 font-semibold transition-all"
              >
                Pay Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => navigate("/transactions/kopokopo")}
                className="flex items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 py-3 font-semibold transition-all"
              >
                <ReceiptText className="w-4 h-4" />
                Transactions
              </button>

            </div>

          </div>

        </div>

        {/* Footer */}

        <div className="mt-12 text-center">

          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-5 py-3 shadow-sm">

            <ShieldCheck className="w-4 h-4 text-green-600" />

            <span className="text-sm text-gray-600 font-medium">
              SmartPOS • Secure Payment Platform
            </span>

          </div>

        </div>

      </div>
    </div>
  );
};

export default HomePage;