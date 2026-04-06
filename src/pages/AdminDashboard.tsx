import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  QrCode, 
  FileText, 
  LogOut, 
  Search,
  RefreshCw,
  DollarSign,
  Ticket,
  Users,
  TrendingUp,
  CalendarDays
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import guichewebLogo from "@/assets/guicheweb-logo.png";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import EventManager from "@/components/admin/EventManager";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_cpf: string;
  customer_phone: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  transaction_id: string;
  created_at: string;
  updated_at: string;
}

const AdminDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const token = sessionStorage.getItem("admin_token");
    if (!token) {
      navigate("/gw-admin-2025");
      return;
    }
    fetchOrders();
  }, [navigate]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data || []) as unknown as Order[]);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar pedidos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_password");
    navigate("/gw-admin-2025");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredOrders = orders.filter(
    (order) =>
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_cpf.includes(searchTerm) ||
      order.transaction_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paidOrders = orders.filter((o) => o.status === "paid");
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalTickets = paidOrders.reduce((sum, o) => {
    const items = o.items as { quantity: number }[];
    return sum + items.reduce((s, i) => s + i.quantity, 0);
  }, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-600">Pago</Badge>;
      case "pending":
        return <Badge className="bg-amber-600">Pendente</Badge>;
      case "refunded":
        return <Badge className="bg-red-600">Reembolsado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={guichewebLogo} alt="Guichê Web" className="h-8" />
            <span className="text-white font-semibold">Admin</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-400 hover:text-white"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border-slate-700 mb-6">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-emerald-600">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-emerald-600">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="checkin" className="data-[state=active]:bg-emerald-600">
              <QrCode className="h-4 w-4 mr-2" />
              Check-in
            </TabsTrigger>
            <TabsTrigger value="events" className="data-[state=active]:bg-emerald-600">
              <CalendarDays className="h-4 w-4 mr-2" />
              Eventos
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-emerald-600">
              <FileText className="h-4 w-4 mr-2" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-400">Receita Total</CardDescription>
                  <CardTitle className="text-2xl text-emerald-400 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {formatCurrency(totalRevenue)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-400">Ingressos Vendidos</CardDescription>
                  <CardTitle className="text-2xl text-blue-400 flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    {totalTickets}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-400">Pedidos Pagos</CardDescription>
                  <CardTitle className="text-2xl text-emerald-400 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {paidOrders.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-400">Pedidos Pendentes</CardDescription>
                  <CardTitle className="text-2xl text-amber-400 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {pendingOrders.length}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Recent Orders */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Pedidos Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Cliente</TableHead>
                      <TableHead className="text-slate-400">Valor</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.slice(0, 5).map((order) => (
                      <TableRow key={order.id} className="border-slate-700">
                        <TableCell className="text-white">{order.customer_name}</TableCell>
                        <TableCell className="text-white">{formatCurrency(Number(order.total_amount))}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-slate-400">
                          {format(new Date(order.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="text-white">Todos os Pedidos</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Buscar por nome, CPF, email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={fetchOrders}
                      className="border-slate-600 text-slate-400 hover:text-white"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">ID</TableHead>
                        <TableHead className="text-slate-400">Cliente</TableHead>
                        <TableHead className="text-slate-400">Email</TableHead>
                        <TableHead className="text-slate-400">CPF</TableHead>
                        <TableHead className="text-slate-400">Itens</TableHead>
                        <TableHead className="text-slate-400">Valor</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id} className="border-slate-700">
                          <TableCell className="text-slate-300 font-mono text-xs">
                            {order.transaction_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-white">{order.customer_name}</TableCell>
                          <TableCell className="text-slate-400">{order.customer_email}</TableCell>
                          <TableCell className="text-slate-400">{order.customer_cpf}</TableCell>
                          <TableCell className="text-slate-400">
                            {(order.items as { quantity: number }[]).reduce((s, i) => s + i.quantity, 0)}
                          </TableCell>
                          <TableCell className="text-white">{formatCurrency(Number(order.total_amount))}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-slate-400">
                            {format(new Date(order.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {filteredOrders.length === 0 && (
                  <p className="text-center text-slate-400 py-8">Nenhum pedido encontrado</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Check-in Tab */}
          <TabsContent value="checkin">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Check-in de Ingressos</CardTitle>
                <CardDescription className="text-slate-400">
                  Valide os ingressos escaneando o QR code ou digitando o código
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-md mx-auto space-y-4">
                  <div className="relative">
                    <QrCode className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Digite o código do ingresso"
                      className="pl-10 bg-slate-700 border-slate-600 text-white text-center text-lg"
                    />
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                    Validar Ingresso
                  </Button>
                  <p className="text-center text-slate-400 text-sm">
                    Funcionalidade de scanner de QR code disponível em breve
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            <EventManager />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Relatórios</CardTitle>
                <CardDescription className="text-slate-400">
                  Exporte dados de vendas e clientes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-600 text-slate-300 hover:text-white"
                  onClick={() => {
                    const csv = [
                      ["Nome", "Email", "CPF", "Telefone", "Valor", "Status", "Data"],
                      ...paidOrders.map((o) => [
                        o.customer_name,
                        o.customer_email,
                        o.customer_cpf,
                        o.customer_phone,
                        o.total_amount,
                        o.status,
                        format(new Date(o.created_at), "dd/MM/yyyy HH:mm"),
                      ]),
                    ]
                      .map((row) => row.join(";"))
                      .join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `vendas-${format(new Date(), "yyyy-MM-dd")}.csv`;
                    a.click();
                    toast({ title: "Sucesso", description: "Relatório exportado!" });
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar Vendas (CSV)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-600 text-slate-300 hover:text-white"
                  onClick={() => {
                    const csv = [
                      ["Nome", "Email", "CPF", "Telefone"],
                      ...paidOrders.map((o) => [
                        o.customer_name,
                        o.customer_email,
                        o.customer_cpf,
                        o.customer_phone,
                      ]),
                    ]
                      .map((row) => row.join(";"))
                      .join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `clientes-${format(new Date(), "yyyy-MM-dd")}.csv`;
                    a.click();
                    toast({ title: "Sucesso", description: "Relatório exportado!" });
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Exportar Lista de Clientes (CSV)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
