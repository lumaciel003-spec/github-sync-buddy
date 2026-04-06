import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MapPin, Ticket, Instagram, Plus, Minus, Loader2, Youtube, Map, Info, AlertTriangle } from "lucide-react";
import { FaWhatsapp, FaFacebookF, FaFacebookMessenger, FaXTwitter } from "react-icons/fa6";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DOMPurify from "dompurify";

interface TicketType {
  id: string;
  sector: string;
  name: string;
  description: string;
  price: number;
  fee: number;
  available: number;
  color: string;
  batch: string;
  sort_order: number;
  is_active: boolean;
}

interface Event {
  id: string;
  name: string;
  slug: string;
  description: string;
  location: string;
  event_date: string;
  event_time: string;
  opening_time: string;
  banner_url: string;
  cover_url: string;
  map_url: string;
  event_map_url: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
  google_maps_embed: string;
  is_active: boolean;
}

const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartTotal, setCartTotal] = useState(0);
  const [cartTotalWithFees, setCartTotalWithFees] = useState(0);
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchEvent();
    }
  }, [slug]);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (eventError) throw eventError;
      
      if (!eventData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setEvent(eventData);

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("ticket_types")
        .select("*")
        .eq("event_id", eventData.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (ticketsError) throw ticketsError;
      setTicketTypes(ticketsData || []);
    } catch (error) {
      console.error("Error fetching event:", error);
      toast.error("Erro ao carregar evento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let total = 0;
    let totalWithFees = 0;
    Object.entries(cart).forEach(([ticketId, quantity]) => {
      const ticket = ticketTypes.find(t => t.id === ticketId);
      if (ticket) {
        total += ticket.price * quantity;
        totalWithFees += (ticket.price + ticket.fee) * quantity;
      }
    });
    setCartTotal(total);
    setCartTotalWithFees(totalWithFees);
  }, [cart, ticketTypes]);

  const ticketsBySector = ticketTypes.reduce((acc, ticket) => {
    if (!acc[ticket.sector]) {
      acc[ticket.sector] = {
        sector: ticket.sector,
        color: ticket.color,
        description: ticket.description,
        tickets: []
      };
    }
    acc[ticket.sector].tickets.push(ticket);
    return acc;
  }, {} as Record<string, { sector: string; color: string; description: string; tickets: TicketType[] }>);

  const handleShare = (platform: string) => {
    const shareUrl = window.location.href;
    const shareText = event ? `${event.name} - ${formatDate(event.event_date)}` : "";
    let url = "";
    switch (platform) {
      case "WhatsApp":
        url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`;
        break;
      case "Facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case "Twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
    }
    if (url) {
      window.open(url, "_blank", "width=600,height=400");
    }
  };

  const toggleSector = (sectorName: string) => {
    setExpandedSectors(prev => ({
      ...prev,
      [sectorName]: !prev[sectorName]
    }));
  };

  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const updateQuantity = (ticketId: string, change: number) => {
    setCart(prev => {
      const currentQty = prev[ticketId] || 0;
      const newQty = Math.max(0, currentQty + change);
      const ticket = ticketTypes.find(t => t.id === ticketId);

      if (ticket && newQty > ticket.available) {
        toast.error("Quantidade não disponível");
        return prev;
      }

      if (newQty === 0) {
        const { [ticketId]: _, ...rest } = prev;
        return rest;
      }

      if (change > 0 && currentQty === 0) {
        toast.success("Ingresso adicionado ao carrinho!");
      }

      return { ...prev, [ticketId]: newQty };
    });
  };

  const handleCheckout = () => {
    const totalQuantity = getTotalItems();
    if (totalQuantity === 0) {
      toast.error("Adicione ingressos ao carrinho");
      return;
    }

    if (cartTotalWithFees > 1000) {
      toast.error("Compras acima de R$ 1.000,00 estão temporariamente indisponíveis", {
        description: "Para evitar golpes de reembolso (MED), compras acima desse valor precisam ser feitas em mais de uma transação.",
        duration: 6000,
        icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />
      });
      return;
    }

    const cartItems = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketId, quantity]) => {
        const ticket = ticketTypes.find(t => t.id === ticketId);
        return {
          id: ticketId,
          name: event?.name || "",
          section: ticket?.sector || "",
          variant: ticket?.name || "",
          price: ticket?.price || 0,
          fee: ticket?.fee || 0,
          quantity
        };
      });

    // Pass event data to checkout for ticket generation
    navigate("/checkout", {
      state: {
        items: cartItems,
        total: cartTotal,
        totalWithFees: cartTotalWithFees,
        eventSlug: slug,
        eventId: event?.id,
        eventData: event ? {
          name: event.name,
          location: event.location,
          date: event.event_date,
          time: event.event_time,
          openingTime: event.opening_time,
          coverUrl: event.cover_url
        } : null
      }
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const formatTime = (timeStr: string) => {
    return timeStr?.slice(0, 5) || "";
  };

  const getGoogleMapsUrl = (embed: string) => {
    if (!embed) return "";
    if (embed.startsWith("http")) return embed;
    const srcMatch = embed.match(/src=["']([^"']+)["']/);
    return srcMatch ? srcMatch[1] : embed;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-gray-600" />
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-gray-600 mb-6">Evento não encontrado</p>
          <Button onClick={() => navigate("/")}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32 overflow-x-hidden">
      <Navbar />

      {/* Hero Banner */}
      <div className="relative mt-16 md:mt-16 lg:flex lg:justify-center lg:bg-gray-100">
        {event.banner_url ? (
          <img 
            src={event.banner_url} 
            alt={event.name} 
            className="w-full h-auto object-contain md:max-h-[350px] lg:max-h-[400px] md:object-cover lg:object-contain" 
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-r from-gray-800 to-gray-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white pointer-events-none"></div>
      </div>

      {/* Main Content */}
      <div className="w-full mx-auto px-4 -mt-20 md:-mt-16 lg:-mt-12 relative z-10">
        <div className="bg-white rounded-lg shadow-2xl p-4 md:p-6 lg:p-8 mb-8 max-w-5xl mx-auto my-[75px] md:my-8">
          <div className="flex flex-col lg:flex-row lg:gap-8 lg:items-start">
            <div className="flex justify-center lg:justify-start mb-6 lg:mb-0 lg:w-1/3">
              <div className="w-full max-w-[320px] lg:max-w-none">
                {event.cover_url ? (
                  <img src={event.cover_url} alt={event.name} className="w-full rounded-lg shadow-md" />
                ) : (
                  <div className="w-full aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
                    <Ticket className="h-20 w-20 text-gray-400" />
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-sm text-center text-gray-600 mb-3">Compartilhar</p>
                  <div className="flex gap-3 justify-center">
                    <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" onClick={() => handleShare("WhatsApp")} title="WhatsApp">
                      <FaWhatsapp className="h-5 w-5 text-green-600" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" onClick={() => handleShare("Facebook")} title="Facebook">
                      <FaFacebookF className="h-5 w-5 text-blue-600" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" onClick={() => window.open(`fb-messenger://share/?link=${encodeURIComponent(window.location.href)}`, "_blank")} title="Messenger">
                      <FaFacebookMessenger className="h-5 w-5 text-blue-500" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" onClick={() => handleShare("Twitter")} title="X (Twitter)">
                      <FaXTwitter className="h-5 w-5 text-gray-800" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center text-center lg:items-start lg:text-left lg:flex-1 space-y-4">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900">
                {event.name}
              </h1>

              <p className="text-xl md:text-xl lg:text-2xl text-gray-700">
                {formatDate(event.event_date)} - {formatTime(event.event_time)}H
              </p>

              <p className="text-lg md:text-base lg:text-lg text-gray-600 flex items-center justify-center lg:justify-start gap-2">
                <MapPin className="h-5 w-5 flex-shrink-0" />
                <span>{event.location}</span>
              </p>

              <div className="pt-2 flex gap-4">
                {event.instagram_url && (
                  <a href={event.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-70 transition-opacity">
                    <Instagram className="h-7 w-7 lg:h-8 lg:w-8 text-gray-800" />
                  </a>
                )}
                {event.facebook_url && (
                  <a href={event.facebook_url} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-70 transition-opacity">
                    <FaFacebookF className="h-7 w-7 lg:h-8 lg:w-8 text-gray-800" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl lg:max-w-none pt-4">
                <button onClick={() => document.getElementById("ingressos")?.scrollIntoView({ behavior: "smooth" })} className="flex items-center justify-center p-4 lg:p-5 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all" title="Ingressos">
                  <Ticket className="h-8 w-8 lg:h-10 lg:w-10 text-gray-700" />
                </button>

                <button onClick={() => document.getElementById("localizacao")?.scrollIntoView({ behavior: "smooth" })} className="flex items-center justify-center p-4 lg:p-5 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all" title="Mapa">
                  <Map className="h-8 w-8 lg:h-10 lg:w-10 text-gray-700" />
                </button>

                <button onClick={() => document.getElementById("info")?.scrollIntoView({ behavior: "smooth" })} className="flex items-center justify-center p-4 lg:p-5 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all" title="Informação">
                  <Info className="h-8 w-8 lg:h-10 lg:w-10 text-gray-700" />
                </button>

                <button 
                  onClick={() => event.youtube_url ? window.open(event.youtube_url, "_blank") : null} 
                  className={`flex items-center justify-center p-4 lg:p-5 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all ${!event.youtube_url ? 'opacity-50 cursor-not-allowed' : ''}`} 
                  title="Youtube"
                  disabled={!event.youtube_url}
                >
                  <Youtube className="h-8 w-8 lg:h-10 lg:w-10 text-gray-700" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Event Map */}
        {event.event_map_url && (
          <div className="max-w-5xl mx-auto mb-8 md:px-4 lg:px-8">
            <h2 className="text-3xl md:text-2xl font-bold mb-6 text-center text-gray-900">
              MAPA DO EVENTO
            </h2>
            <div className="rounded-lg overflow-hidden shadow-md md:max-w-2xl lg:max-w-3xl md:mx-auto">
              <img src={event.event_map_url} alt="Mapa do Evento - Setores" className="w-full h-auto md:max-h-[400px] lg:max-h-[500px] object-contain" />
            </div>
          </div>
        )}

        {/* Tickets Section */}
        <div id="ingressos" className="max-w-5xl mx-auto mb-8">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-900">
            INGRESSOS
          </h2>

          {Object.keys(ticketsBySector).length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Ticket className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Nenhum ingresso disponível no momento</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.values(ticketsBySector).map(sectorGroup => {
                const isExpanded = expandedSectors[sectorGroup.sector];
                const lowestPrice = Math.min(...sectorGroup.tickets.map(t => t.price));
                
                return (
                  <div key={sectorGroup.sector} className={`shadow rounded-lg overflow-hidden transition-colors ${isExpanded ? "bg-gray-700" : "bg-gray-100"}`}>
                    <button onClick={() => toggleSector(sectorGroup.sector)} className="w-full flex items-center justify-between p-4 hover:opacity-90 transition-opacity">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: sectorGroup.color }} />
                        <div className="text-left">
                          <h3 className={`font-semibold text-lg ${isExpanded ? "text-white" : "text-gray-900"}`}>
                            {sectorGroup.sector}
                          </h3>
                          {sectorGroup.description && (
                            <p className={`text-sm ${isExpanded ? "text-gray-200" : "text-gray-500"}`}>
                              {sectorGroup.description}
                            </p>
                          )}
                          <p className={`text-sm font-medium ${isExpanded ? "text-gray-200" : "text-gray-600"}`}>
                            a partir de {formatCurrency(lowestPrice)}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xl font-bold ${isExpanded ? "text-white" : "text-gray-900"}`}>
                        {isExpanded ? "−" : "+"}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="bg-gray-100 px-4 py-4 space-y-4">
                        {sectorGroup.tickets.map(ticket => (
                          <div key={ticket.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                            <div className="space-y-1 mb-3">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Ingresso:</span> {sectorGroup.sector} ({ticket.name})
                              </p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Lote:</span> {ticket.batch || "1. LOTE"}
                              </p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Valor:</span> {formatCurrency(ticket.price)} + {formatCurrency(ticket.fee)} de taxa
                              </p>
                            </div>

                            <div className="flex items-center justify-end gap-2 bg-white rounded-lg p-2">
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-gray-100" onClick={() => updateQuantity(ticket.id, -1)} disabled={!cart[ticket.id] || cart[ticket.id] === 0}>
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-12 text-center font-bold text-gray-900">
                                {cart[ticket.id] || 0}
                              </span>
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-gray-100" onClick={() => updateQuantity(ticket.id, 1)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Section */}
        {event.description && (
          <div id="info" className="max-w-5xl mx-auto mb-8">
            <h2 className="text-3xl font-bold mb-6 text-center text-gray-900">
              INFORMAÇÕES
            </h2>
            <div className="bg-gray-50 rounded-lg p-6">
              <div 
                className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description) }}
              />
            </div>
          </div>
        )}

        {/* Rules Accordion */}
        <div className="max-w-5xl mx-auto mb-8">
          <Accordion type="single" collapsible className="bg-white rounded-lg shadow-md">
            <AccordionItem value="item-1" className="border-none">
              <AccordionTrigger className="px-6 py-4 text-xl font-semibold hover:no-underline">
                Regras para venda on-line
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 space-y-3 text-sm text-gray-600">
                <p>1. Todas as disposições aplicáveis às vendas de ingressos pela plataforma da Guichê Web se encontram previstas nos Termos de Uso.</p>
                <p>2. A Guichê Web é uma plataforma intermediária especializada na venda de ingressos online e não organiza os eventos comercializados.</p>
                <p>3. Para acessar o evento é obrigatória a apresentação do ingresso impresso e assinado ou em formato digital através do App (Guichê Web), juntamente com documento de identificação oficial com foto.</p>
                <p>4. O não comparecimento ao evento invalidará o ingresso e não permitirá reembolso.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <Separator className="my-8 max-w-5xl mx-auto" />

        {/* Location Section */}
        <div id="localizacao" className="max-w-5xl mx-auto mb-8">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-900">
            LOCALIZAÇÃO
          </h2>
          <Separator className="mb-6" />
          <div className="aspect-video rounded-lg overflow-hidden shadow-md">
            {event.google_maps_embed ? (
              <iframe
                src={getGoogleMapsUrl(event.google_maps_embed)}
                className="w-full h-full"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : event.map_url ? (
              <img src={event.map_url} alt="Localização" className="w-full h-auto" />
            ) : (
              <div className="h-64 bg-gray-200 flex items-center justify-center">
                <MapPin className="h-16 w-16 text-gray-400" />
              </div>
            )}
          </div>
          <p className="text-center text-gray-600 mt-4">{event.location}</p>
        </div>

        {/* Footer */}
        <footer className="max-w-5xl mx-auto bg-black text-white py-8 rounded-lg">
          <div className="text-center space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer" className="inline-block">
                <div className="bg-white text-black px-6 py-3 rounded-lg flex items-center gap-3 hover:bg-gray-100 transition-colors">
                  <div className="text-left">
                    <div className="text-xs">Disponível na</div>
                    <div className="text-lg font-semibold">App Store</div>
                  </div>
                </div>
              </a>

              <a href="https://play.google.com" target="_blank" rel="noopener noreferrer" className="inline-block">
                <div className="bg-white text-black px-6 py-3 rounded-lg flex items-center gap-3 hover:bg-gray-100 transition-colors">
                  <div className="text-left">
                    <div className="text-xs">Disponível no</div>
                    <div className="text-lg font-semibold">Google Play</div>
                  </div>
                </div>
              </a>
            </div>

            <div className="space-y-2 text-sm text-gray-300 px-4">
              <p>Guichê Web Comercialização de Ingressos Ltda - CNPJ - 18.797.249/0001-35</p>
              <p>Todos os preços e condições comerciais estão sujeitos a alteração comercial sem aviso prévio.</p>
              <p>©Todos os direitos reservados.</p>
            </div>
          </div>
        </footer>
      </div>

      {/* Fixed Cart Bar - Green Style */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 shadow-2xl z-50" style={{ backgroundColor: 'rgba(29, 115, 28, 0.95)' }}>
          <div className="w-full mx-auto px-4 py-3">
            <div className="flex items-center justify-between max-w-5xl mx-auto">
              <div className="flex-1">
                <p className="font-bold text-white text-sm mb-1">
                  {getTotalItems()} {getTotalItems() === 1 ? 'ITEM' : 'ITENS'} NO CARRINHO
                </p>
                <p className="text-2xl font-bold text-white mb-1">
                  {formatCurrency(cartTotalWithFees)}
                </p>
                <p className="text-sm text-white">
                  (Ingressos: {formatCurrency(cartTotal)} + Taxas: {formatCurrency(cartTotalWithFees - cartTotal)})
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-sm text-white">Tudo pronto?</p>
                <Button size="lg" className="bg-white hover:bg-gray-100 text-gray-900 font-semibold" onClick={handleCheckout}>
                  CONTINUAR
                  <span className="ml-2">›</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventPage;
