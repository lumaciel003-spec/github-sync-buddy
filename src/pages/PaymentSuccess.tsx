import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail, Home, Clock } from "lucide-react";
import guichewebLogo from "@/assets/guicheweb-logo.png";
import guichewebLogoFull from "@/assets/guicheweb-logo-full.png";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { transactionId?: string; customerEmail?: string } | null;
  const transactionId = state?.transactionId;
  const customerEmail = state?.customerEmail;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center">
            <img src={guichewebLogo} alt="Guichê Web" className="h-8" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 max-w-lg">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Pagamento Aprovado!
          </h1>
          <p className="text-gray-600 mb-6">
            Sua compra foi realizada com sucesso.
          </p>

          {transactionId && (
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">Número da transação:</p>
              <p className="font-mono font-bold text-gray-800">{transactionId}</p>
            </div>
          )}

          {/* Ticket Delivery Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6 text-left">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-yellow-800 text-lg mb-2">
                  Aguarde seu Ingresso
                </h3>
                <p className="text-yellow-700 mb-3">
                  Em breve você receberá seu ingresso disponível para download (PDF) em seu e-mail
                  {customerEmail && (
                    <strong className="block mt-1">{customerEmail}</strong>
                  )}
                </p>
                <p className="text-yellow-700 text-sm mb-3">
                  <strong>Importante:</strong> O tempo de processamento varia dependendo da demanda de clientes do evento adquirido.
                </p>
                <p className="text-yellow-700 text-sm mb-3">
                  Se o processo levar mais de <strong>2 horas</strong>, por favor envie o nome utilizado na compra, e-mail e comprovante de pagamento para o WhatsApp:
                </p>
                <div className="flex flex-col gap-1 text-sm text-yellow-800 font-medium mb-3">
                  <a href="https://wa.me/5551998768316" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    📱 (51) 99876-8316
                  </a>
                  <a href="https://wa.me/5551997779019" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    📱 (51) 99777-9019
                  </a>
                  <span className="text-yellow-600 text-xs">(responsáveis por esse evento)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-yellow-600">
                  <Mail className="h-4 w-4" />
                  <span>Verifique sua caixa de entrada e spam</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 text-left">
            <p className="text-sm text-gray-600">
              Seus ingressos também estarão disponíveis para consulta no site através do menu 
              <strong> "Buscar Pedidos"</strong> após o processamento.
            </p>
          </div>

          {/* Action Button */}
          <Button
            onClick={() => navigate('/')}
            className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-6 text-lg"
          >
            <Home className="h-5 w-5 mr-2" />
            Voltar para Início
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center mb-2">
            <img src={guichewebLogoFull} alt="Guichê Web" className="h-8" />
          </div>
          <p>Todos os direitos reservados</p>
          <p className="mt-1">Ambiente seguro para pagamento</p>
        </div>
      </footer>
    </div>
  );
};

export default PaymentSuccess;
