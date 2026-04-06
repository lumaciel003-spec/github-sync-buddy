import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Check, ArrowRight, QrCode, Copy, Clock, Ticket } from "lucide-react";
import guichewebLogo from "@/assets/guicheweb-logo.png";
import guichewebLogoFull from "@/assets/guicheweb-logo-full.png";
import pixPhoneIllustration from "@/assets/pix-phone-illustration.png";
import { supabase } from "@/integrations/supabase/client";

interface CartItem {
  id: string;
  name: string;
  section: string;
  variant: string;
  price: number;
  fee: number;
  quantity: number;
}

interface EventData {
  name: string;
  location: string;
  date: string;
  time: string;
  openingTime?: string;
  coverUrl?: string;
}

interface CheckoutState {
  items: CartItem[];
  total: number;
  totalWithFees: number;
  eventSlug?: string;
  eventId?: string;
  eventData?: EventData;
}

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState<'personal' | 'payment' | 'pix'>('personal');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    celular: ''
  });
  
  // PIX state
  const [pixData, setPixData] = useState<{
    qrCode: string;
    copiaCola: string;
    expiresAt: Date | null;
  }>({
    qrCode: '',
    copiaCola: '',
    expiresAt: null
  });

  // Get cart data from navigation state
  const checkoutState = location.state as CheckoutState | null;

  useEffect(() => {
    if (!checkoutState || !checkoutState.items || checkoutState.items.length === 0) {
      toast.error("Carrinho vazio");
      const redirectPath = checkoutState?.eventSlug ? `/e/${checkoutState.eventSlug}` : '/';
      navigate(redirectPath);
    }
  }, [checkoutState, navigate]);

  if (!checkoutState) {
    return null;
  }

  const { items, total, totalWithFees, eventSlug, eventId, eventData } = checkoutState;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'cpf') {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 11) {
        setFormData(prev => ({ ...prev, cpf: formatCPF(numbers) }));
      }
    } else if (field === 'celular') {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 11) {
        setFormData(prev => ({ ...prev, celular: formatPhone(numbers) }));
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const validatePersonalData = () => {
    if (!formData.nome.trim()) {
      toast.error("Digite seu nome completo");
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error("Digite um e-mail válido");
      return false;
    }
    const cpfNumbers = formData.cpf.replace(/\D/g, '');
    if (cpfNumbers.length !== 11) {
      toast.error("CPF deve ter 11 dígitos");
      return false;
    }
    const phoneNumbers = formData.celular.replace(/\D/g, '');
    if (phoneNumbers.length < 10) {
      toast.error("Digite um número de celular válido");
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (step === 'personal') {
      if (validatePersonalData()) {
        setStep('payment');
      }
    }
  };

  const handleGeneratePix = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-pix-payment', {
        body: {
          amount: totalWithFees,
          customerName: formData.nome,
          customerEmail: formData.email,
          customerCpf: formData.cpf.replace(/\D/g, ''),
          customerPhone: formData.celular.replace(/\D/g, ''),
          eventId: eventId,
          items: items.map(item => ({
            name: `${item.section} - ${item.variant}`,
            quantity: item.quantity,
            price: item.price + item.fee
          }))
        }
      });

      if (error) {
        console.error('Error creating PIX:', error);
        toast.error("Erro ao gerar PIX. Tente novamente.");
        setIsLoading(false);
        return;
      }

      // Check for specific errors in the response
      if (data?.error) {
        console.error('PIX error response:', data);
        
        // Check if it's a CPF-related error
        const errorDetails = JSON.stringify(data.details || data.error || '').toLowerCase();
        if (errorDetails.includes('cpf') || errorDetails.includes('document') || errorDetails.includes('invalid')) {
          toast.error("CPF inválido ou incorreto. Por favor, revise o CPF informado.", {
            duration: 5000,
          });
        } else {
          toast.error("Erro ao gerar PIX. Verifique os dados informados e tente novamente.");
        }
        setIsLoading(false);
        return;
      }

      if (data?.qrCode && data?.copiaCola) {
        setPixData({
          qrCode: data.qrCode,
          copiaCola: data.copiaCola,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        });
        setCurrentTransactionId(data.transactionId);
        setStep('pix');
      } else {
        // No QR code in response - likely a validation error
        toast.error("Não foi possível gerar o PIX. Revise os dados informados, especialmente o CPF.", {
          duration: 5000,
        });
      }
    } catch (err) {
      console.error('Error generating PIX:', err);
      toast.error("Erro ao gerar PIX. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyPixCode = () => {
    navigator.clipboard.writeText(pixData.copiaCola);
    toast.success("Código PIX copiado!");
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTotalFees = () => {
    return items.reduce((sum, item) => sum + (item.fee * item.quantity), 0);
  };

  // Transaction ID for tracking
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);

  // Countdown timer for PIX
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds

  useEffect(() => {
    if (step === 'pix' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeLeft]);

  // Poll for payment status
  useEffect(() => {
    if (step === 'pix' && currentTransactionId) {
      const checkPaymentStatus = async () => {
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('status')
            .eq('transaction_id', currentTransactionId)
            .maybeSingle();

          if (!error && data?.status === 'paid') {
            toast.success("Pagamento confirmado!");
            navigate('/pagamento-aprovado', { state: { transactionId: currentTransactionId, customerEmail: formData.email } });
          }
        } catch (err) {
          console.error('Error checking payment status:', err);
        }
      };

      // Check every 5 seconds
      const pollInterval = setInterval(checkPaymentStatus, 5000);
      return () => clearInterval(pollInterval);
    }
  }, [step, currentTransactionId, navigate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

      {step === 'pix' ? (
        // Full PIX Payment Screen
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Já é quase seu...</h1>
            <p className="text-gray-600 mb-6">
              Pague seu pix dentro de <span className="font-semibold text-gray-800">{formatTime(timeLeft)}</span> para garantir sua compra.
            </p>
            
            {/* Phone illustration */}
            <div className="flex justify-center mb-6">
              <img 
                src={pixPhoneIllustration} 
                alt="Pague com PIX" 
                className="w-48 h-48 object-contain"
              />
            </div>
            
            <p className="text-gray-600 mb-4">Aponte a câmera do seu celular</p>
            
            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <div className="bg-white p-2 border-2 border-gray-200 rounded-lg">
                <img 
                  src={pixData.qrCode} 
                  alt="QR Code PIX" 
                  className="w-56 h-56"
                />
              </div>
            </div>
            
            {/* Status */}
            <div className="bg-yellow-100 text-yellow-800 px-6 py-3 rounded-full inline-flex items-center gap-2 mb-6">
              <span className="font-medium">Aguardando pagamento</span>
              <span className="animate-pulse">...</span>
            </div>
            
            {/* Copy and Paste Code */}
            <div className="mb-4">
              <Input 
                value={pixData.copiaCola} 
                readOnly 
                className="bg-gray-100 text-xs text-center border-gray-200 mb-3"
              />
              <Button 
                onClick={copyPixCode}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 text-lg"
              >
                <Copy className="h-5 w-5 mr-2" />
                Copiar código pix
              </Button>
            </div>
            
            {/* Value */}
            <p className="text-gray-600 mb-6">
              Valor do Pix: <span className="text-green-500 font-bold">{formatCurrency(totalWithFees)}</span>
            </p>
            
            {/* Instructions */}
            <div className="text-left">
              <h3 className="font-semibold text-gray-800 mb-4">Como pagar o pix:</h3>
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm shrink-0">1</span>
                  <span className="text-gray-600">Clique em <span className="text-green-500 font-medium">copiar o código PIX</span>, logo acima</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm shrink-0">2</span>
                  <span className="text-gray-600">Acesse o <span className="text-green-500 font-medium">app do seu banco</span></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm shrink-0">3</span>
                  <span className="text-gray-600">Vá até a opção <span className="text-green-500 font-medium">PIX</span></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm shrink-0">4</span>
                  <span className="text-gray-600">Escolha a opção "<span className="text-green-500 font-medium">COPIA E COLA</span>"</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm shrink-0">5</span>
                  <span className="text-green-500 font-medium">Insira o código copiado e finalize seu pagamento</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        // Checkout Form
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Order Summary Sidebar - Shows first on mobile */}
              <div className="lg:col-span-1 order-first lg:order-last">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 sticky top-4">
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Resumo do pedido</h3>
                    
                    <Separator className="mb-4" />
                    
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="text-gray-800">{formatCurrency(total)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Taxa de serviço</span>
                      <span className="text-gray-800">{formatCurrency(getTotalFees())}</span>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="flex justify-between font-bold text-lg mb-6">
                      <span className="text-gray-800">Total</span>
                      <span className="text-gray-800">{formatCurrency(totalWithFees)}</span>
                    </div>
                    
                    {/* Cart Items */}
                    <div className="space-y-4">
                      {items.map((item, index) => (
                        <div key={index} className="flex gap-3">
                          {eventData?.coverUrl ? (
                            <img 
                              src={eventData.coverUrl} 
                              alt={item.name}
                              className="w-16 h-16 rounded object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded bg-gray-200 flex items-center justify-center">
                              <Ticket className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-gray-800">
                              {item.section} - {item.variant}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {item.quantity}x {formatCurrency(item.price + item.fee)}
                            </p>
                            <p className="text-sm font-medium text-gray-800">
                              {formatCurrency((item.price + item.fee) * item.quantity)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Personal Data Section */}
                <div className={`bg-white rounded-lg shadow-sm border ${step === 'personal' ? 'border-green-500' : 'border-gray-200'}`}>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step !== 'personal' && formData.nome ? 'bg-green-500 text-white' : 'bg-gray-800 text-white'}`}>
                        {step !== 'personal' && formData.nome ? <Check className="h-5 w-5" /> : '1'}
                      </div>
                      <h2 className="text-lg font-bold text-gray-800 uppercase">Dados Pessoais</h2>
                    </div>
                    
                    {step === 'personal' ? (
                      <>
                        <p className="text-sm text-gray-600 mb-6">
                          Pedimos apenas as informações essenciais para concluir sua compra com <span className="text-green-600 font-medium">segurança</span>.
                        </p>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="nome" className="text-gray-700 font-medium">Nome completo</Label>
                            <Input
                              id="nome"
                              placeholder="Ex: Mariana Cardoso Silva"
                              value={formData.nome}
                              onChange={(e) => handleInputChange('nome', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="email" className="text-gray-700 font-medium">E-mail</Label>
                            <div className="relative">
                              <Input
                                id="email"
                                type="email"
                                placeholder="ex: marianacardoso@gmail.com"
                                value={formData.email}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                className="mt-1"
                              />
                              {formData.email.includes('@') && formData.email.includes('.') && (
                                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500 mt-0.5" />
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="cpf" className="text-gray-700 font-medium">CPF</Label>
                            <Input
                              id="cpf"
                              placeholder="000.000.000-00"
                              value={formData.cpf}
                              onChange={(e) => handleInputChange('cpf', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="celular" className="text-gray-700 font-medium">Celular/Whatsapp</Label>
                            <div className="flex gap-2 mt-1">
                              <div className="flex items-center px-3 bg-gray-100 rounded-md border border-gray-200">
                                <span className="text-gray-600">+55</span>
                              </div>
                              <Input
                                id="celular"
                                placeholder="(00) 00000-0000"
                                value={formData.celular}
                                onChange={(e) => handleInputChange('celular', e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>
                          
                          <Button 
                            onClick={handleContinue}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg"
                          >
                            CONTINUAR
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-600">
                        <p><strong>Nome:</strong> {formData.nome}</p>
                        <p><strong>E-mail:</strong> {formData.email}</p>
                        <p><strong>CPF:</strong> {formData.cpf}</p>
                        <p><strong>Celular:</strong> +55 {formData.celular}</p>
                        <Button 
                          variant="link" 
                          className="p-0 h-auto text-green-600"
                          onClick={() => setStep('personal')}
                        >
                          Editar dados
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Section */}
                <div className={`bg-white rounded-lg shadow-sm border ${step === 'payment' ? 'border-green-500' : 'border-gray-200'}`}>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'payment' ? 'bg-gray-800 text-white' : 'bg-gray-300 text-gray-500'}`}>
                        2
                      </div>
                      <h2 className="text-lg font-bold text-gray-800 uppercase">Opção de Pagamento</h2>
                    </div>
                    
                    {step === 'personal' ? (
                      <p className="text-sm text-gray-400">
                        Preencha suas informações de entrega para continuar
                      </p>
                    ) : step === 'payment' && (
                      <div className="space-y-4">
                        <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full border-2 border-green-500 flex items-center justify-center">
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            </div>
                            <div className="flex items-center gap-2">
                              <QrCode className="h-6 w-6 text-green-600" />
                              <span className="font-semibold text-gray-800">PIX</span>
                            </div>
                          </div>
                          <div className="mt-3 ml-9 space-y-2">
                            <p className="text-sm text-gray-700 font-medium">
                              A confirmação do seu pagamento é mais rápida
                            </p>
                            <p className="text-sm text-gray-600">
                              Após clicar em 'Finalizar compra' você terá 30 minutos para pagar com Pix usando QR Code ou código que será exibido. A confirmação é instantânea.
                            </p>
                            <p className="text-green-600 font-semibold">
                              Valor no Pix: {formatCurrency(totalWithFees)}
                            </p>
                          </div>
                        </div>
                        
                        <Button 
                          onClick={handleGeneratePix}
                          disabled={isLoading}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg"
                        >
                          {isLoading ? 'GERANDO PIX...' : 'FINALIZAR COMPRA'}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

export default Checkout;
