import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Loader2, Mail, Clock, Ticket } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import SearchOrdersDialog from "@/components/SearchOrdersDialog";
import { supabase } from "@/integrations/supabase/client";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  transaction_id: string;
  customer_name: string;
  customer_cpf: string;
  customer_email: string;
  customer_phone: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

const MeusPedidos = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  useEffect(() => {
    const state = location.state as { 
      orders?: Order[]; 
      fromPayment?: boolean; 
      transactionId?: string;
      searchQuery?: string;
    } | null;

    if (state?.orders) {
      const parsedOrders = state.orders.map(order => ({
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
      }));
      setOrders(parsedOrders);
    } else if (state?.fromPayment && state?.transactionId) {
      fetchOrderByTransaction(state.transactionId);
    } else {
      setSearchDialogOpen(true);
    }
  }, [location.state]);

  const fetchOrderByTransaction = async (transactionId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('transaction_id', transactionId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching order:', error);
        toast.error("Erro ao buscar pedido");
        return;
      }

      if (data) {
        const parsedOrder = {
          ...data,
          items: typeof data.items === 'string' ? JSON.parse(data.items) : data.items
        };
        setOrders([parsedOrder]);
      } else {
        toast.info("Pedido ainda não encontrado. Tente novamente em alguns segundos.");
        setSearchDialogOpen(true);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error("Erro ao buscar pedido");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalTickets = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="pt-20 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-yellow-600 mx-auto mb-4" />
            <p className="text-gray-600">Buscando seus pedidos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <div className="pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-gray-600"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Voltar
              </Button>
              <h1 className="text-2xl font-bold text-gray-800">Meus Pedidos</h1>
            </div>
            <Button
              onClick={() => setSearchDialogOpen(true)}
              variant="outline"
              className="border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-white"
            >
              <Search className="h-5 w-5 mr-2" />
              Buscar Outro Pedido
            </Button>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Nenhum pedido encontrado
              </h2>
              <p className="text-gray-600 mb-6">
                Busque seus pedidos usando seu CPF ou e-mail
              </p>
              <Button
                onClick={() => setSearchDialogOpen(true)}
                className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
              >
                <Search className="h-5 w-5 mr-2" />
                Buscar Pedidos
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const totalTickets = getTotalTickets(order.items);

                return (
                  <div key={order.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    {/* Order Header */}
                    <div className="bg-gray-50 border-b p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h2 className="font-bold text-lg text-gray-800">
                            Pedido #{order.transaction_id}
                          </h2>
                          <p className="text-sm text-gray-600">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            order.status === 'approved' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.status === 'approved' ? 'Aprovado' : 'Pendente'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="p-6">
                      {/* Customer Info */}
                      <div className="mb-6">
                        <h3 className="font-semibold text-gray-800 mb-2">Dados do Comprador</h3>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><strong>Nome:</strong> {order.customer_name}</p>
                          <p><strong>E-mail:</strong> {order.customer_email}</p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mb-6">
                        <h3 className="font-semibold text-gray-800 mb-2">Itens do Pedido</h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-700">{item.quantity}x {item.name}</span>
                              <span className="font-medium text-gray-800">
                                R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          ))}
                          <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                            <span>Total ({totalTickets} ingresso{totalTickets > 1 ? 's' : ''})</span>
                            <span>R$ {order.total_amount.toFixed(2).replace('.', ',')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pending Ticket Message */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                              <Clock className="h-6 w-6 text-yellow-600" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-yellow-800 text-lg mb-2">
                              Ingresso em Processamento
                            </h4>
                            <p className="text-yellow-700 mb-3">
                              Em breve você receberá seu ingresso disponível para download (PDF) em seu e-mail 
                              <strong className="block mt-1">{order.customer_email}</strong>
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
                              <span>Fique atento à sua caixa de entrada e spam</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Additional Info */}
                      <div className="mt-6 flex items-center gap-3 text-sm text-gray-500">
                        <Ticket className="h-5 w-5" />
                        <span>Seus ingressos também estarão disponíveis aqui no site após o processamento</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SearchOrdersDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} />
    </div>
  );
};

export default MeusPedidos;
