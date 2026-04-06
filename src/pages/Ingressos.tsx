import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { MapPin, Ticket, Instagram, Plus, Minus, Loader2, Youtube, Map, Info, AlertTriangle } from "lucide-react";
import { FaWhatsapp, FaFacebookF, FaFacebookMessenger, FaXTwitter } from "react-icons/fa6";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import eventCover from "@/assets/event-cover.jpg";
import eventBanner from "@/assets/event-banner.png";
interface TicketType {
  id: string;
  section: string;
  price: number;
  available: number;
  color: string;
}
const Ingressos = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartTotal, setCartTotal] = useState(0);
  const [cartTotalWithFees, setCartTotalWithFees] = useState(0);
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});
  const eventData = {
    name: "Ahh Verão - Henrique e Juliano + Nattan",
    date: "02/01/2026",
    time: "21:00H",
    location: "Arena Open Camboriú - CAMBORIÚ/SC",
    image: eventCover,
    cover: eventBanner,
    logo: "",
    instagram: "https://www.instagram.com/gdoproducoes/",
    facebook: "https://www.facebook.com/gdoproducoes",
    mapsEmbedUrl: "https://maps.google.com/maps?q=Arena+Open+Camboriú,+Camboriú+-+SC,+Brasil&center=-27.0253,-48.6513&t=&z=15&ie=UTF8&iwloc=&output=embed"
  };
  interface TicketVariant {
    id: string;
    name: string;
    price: number;
  }
  interface TicketSector {
    id: string;
    section: string;
    description: string;
    color: string;
    available: number;
    variants: TicketVariant[];
  }
  interface TicketVariantWithFee extends TicketVariant {
    fee: number;
  }
  interface TicketSectorWithFee extends Omit<TicketSector, 'variants'> {
    variants: TicketVariantWithFee[];
  }
  const ticketSectors: TicketSectorWithFee[] = [{
    id: 'teste',
    section: 'Área Teste',
    description: 'Ingresso para testes - NÃO USAR EM PRODUÇÃO',
    color: '#FF0000',
    available: 100,
    variants: [{
      id: 'teste-inteira',
      name: 'Inteira',
      price: 2.50,
      fee: 0.00
    }]
  }, {
    id: 'frontstage',
    section: 'Frontstage Open Food',
    description: 'Open Food: Massas, risotos e doces',
    color: '#FFD700',
    available: 50,
    variants: [{
      id: 'frontstage-inteira',
      name: 'Inteira',
      price: 370,
      fee: 19.92
    }]
  }, {
    id: 'premium',
    section: 'Premium Open Bar +18',
    description: 'Open Bar de Água, cerveja, refrigerante, suco, vodka',
    color: '#9333EA',
    available: 100,
    variants: [{
      id: 'premium-inteira',
      name: 'Inteira',
      price: 285,
      fee: 14.68
    }]
  }, {
    id: 'vip',
    section: 'Área VIP',
    description: 'Visão frontal do palco; Área de convivência; Banheiros no setor.',
    color: '#3B82F6',
    available: 200,
    variants: [{
      id: 'vip-inteira',
      name: 'Inteira',
      price: 230,
      fee: 14.68
    }, {
      id: 'vip-meia',
      name: 'Meia',
      price: 115,
      fee: 7.34
    }, {
      id: 'vip-solidario',
      name: 'Solidário (+1KG alimento)',
      price: 130,
      fee: 11.53
    }]
  }, {
    id: 'arena',
    section: 'Arena',
    description: 'Visão frontal do palco; Área de convivência; Setor com menor custo.',
    color: '#22C55E',
    available: 500,
    variants: [{
      id: 'arena-inteira',
      name: 'Inteira',
      price: 170,
      fee: 12.47
    }, {
      id: 'arena-meia',
      name: 'Meia',
      price: 85,
      fee: 7.42
    }, {
      id: 'arena-solidario',
      name: 'Solidário (+1KG alimento)',
      price: 100,
      fee: 8.14
    }, {
      id: 'arena-pcd',
      name: 'PCD ou Acompanhante PCD',
      price: 85,
      fee: 7.42
    }]
  }];

  // For backward compatibility with cart logic
  const tickets: TicketType[] = ticketSectors.flatMap(sector => sector.variants.map(variant => ({
    id: variant.id,
    section: `${sector.section} - ${variant.name}`,
    price: variant.price,
    color: sector.color,
    available: sector.available
  })));
  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 1500);
  }, []);
  useEffect(() => {
    let total = 0;
    let totalWithFees = 0;
    Object.entries(cart).forEach(([ticketId, quantity]) => {
      const sector = ticketSectors.find(s => s.variants.some(v => v.id === ticketId));
      const variant = sector?.variants.find(v => v.id === ticketId);
      if (variant) {
        total += variant.price * quantity;
        totalWithFees += (variant.price + variant.fee) * quantity;
      }
    });
    setCartTotal(total);
    setCartTotalWithFees(totalWithFees);
  }, [cart]);
  const handleShare = (platform: string) => {
    const shareUrl = window.location.href;
    const shareText = `${eventData.name} - ${eventData.date}`;
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
      window.open(url, '_blank', 'width=600,height=400');
    }
  };
  const toggleSector = (ticketId: string) => {
    setExpandedSectors(prev => ({
      ...prev,
      [ticketId]: !prev[ticketId]
    }));
  };
  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const updateQuantity = (ticketId: string, change: number) => {
    setCart(prev => {
      const currentQty = prev[ticketId] || 0;
      const newQty = Math.max(0, currentQty + change);
      const ticket = tickets.find(t => t.id === ticketId);
      
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
    
    // Check if total exceeds R$1000
    if (cartTotalWithFees > 1000) {
      toast.error("Compras acima de R$ 1.000,00 estão temporariamente indisponíveis", {
        description: "Para evitar golpes de reembolso (MED), compras acima desse valor precisam ser feitas em mais de uma transação.",
        duration: 6000,
        icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />
      });
      return;
    }
    
    // Build cart items for checkout
    const cartItems = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketId, quantity]) => {
        const sector = ticketSectors.find(s => s.variants.some(v => v.id === ticketId));
        const variant = sector?.variants.find(v => v.id === ticketId);
        return {
          id: ticketId,
          name: eventData.name,
          section: sector?.section || '',
          variant: variant?.name || '',
          price: variant?.price || 0,
          fee: variant?.fee || 0,
          quantity
        };
      });
    
    navigate('/checkout', {
      state: {
        items: cartItems,
        total: cartTotal,
        totalWithFees: cartTotalWithFees
      }
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };
  return <div className="min-h-screen bg-white pb-32">
      <Navbar />

      {/* Hero Banner */}
      <div className="relative mt-16">
        <img src={eventData.cover} alt={eventData.name} className="w-full h-auto object-contain" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white pointer-events-none"></div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 -mt-20 md:-mt-24 relative z-10">
        <div className="bg-white rounded-lg shadow-2xl p-4 md:p-8 mb-8 max-w-5xl mx-0 my-[75px]">
          <div className="flex flex-col lg:flex-row lg:gap-8 lg:items-start">
            <div className="flex justify-center lg:justify-start mb-6 lg:mb-0 lg:w-1/3">
              <div className="w-full max-w-[320px] lg:max-w-none">
                <img src={eventData.image} alt={eventData.name} className="w-full rounded-lg shadow-md" />

                <div className="mt-4">
                  <p className="text-sm text-center text-gray-600 mb-3">Compartilhar</p>
                  <div className="flex gap-3 justify-center">
                    <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" onClick={() => handleShare("WhatsApp")} title="WhatsApp">
                      <FaWhatsapp className="h-5 w-5 text-green-600" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" onClick={() => handleShare("Facebook")} title="Facebook">
                      <FaFacebookF className="h-5 w-5 text-blue-600" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" onClick={() => window.open(`fb-messenger://share/?link=${encodeURIComponent(window.location.href)}`, '_blank')} title="Messenger">
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
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900">
                {eventData.name}
              </h1>

              <p className="text-xl md:text-2xl lg:text-3xl text-gray-700">
                {eventData.date} - {eventData.time}
              </p>

              <p className="text-lg lg:text-xl text-gray-600 flex items-center justify-center lg:justify-start gap-2">
                <MapPin className="h-5 w-5 lg:h-6 lg:w-6 flex-shrink-0" />
                <span>{eventData.location}</span>
              </p>

              <div className="pt-2 flex gap-4">
                <a href={eventData.instagram} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-70 transition-opacity">
                  <Instagram className="h-7 w-7 lg:h-8 lg:w-8 text-gray-800" />
                </a>
                <a href={eventData.facebook} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-70 transition-opacity">
                  <FaFacebookF className="h-7 w-7 lg:h-8 lg:w-8 text-gray-800" />
                </a>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl lg:max-w-none pt-4">
                <button onClick={() => document.getElementById('ingressos')?.scrollIntoView({
                behavior: 'smooth'
              })} className="flex items-center justify-center p-4 lg:p-5 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all" title="Ingressos">
                  <Ticket className="h-8 w-8 lg:h-10 lg:w-10 text-gray-700" />
                </button>

                <button onClick={() => document.getElementById('localizacao')?.scrollIntoView({
                behavior: 'smooth'
              })} className="flex items-center justify-center p-4 lg:p-5 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all" title="Mapa">
                  <Map className="h-8 w-8 lg:h-10 lg:w-10 text-gray-700" />
                </button>

                <button onClick={() => document.getElementById('info')?.scrollIntoView({
                behavior: 'smooth'
              })} className="flex items-center justify-center p-4 lg:p-5 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all" title="Informação">
                  <Info className="h-8 w-8 lg:h-10 lg:w-10 text-gray-700" />
                </button>

                <button onClick={() => window.open('https://www.youtube.com', '_blank')} className="flex items-center justify-center p-4 lg:p-5 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all" title="Youtube">
                  <Youtube className="h-8 w-8 lg:h-10 lg:w-10 text-gray-700" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Event Map */}
        <div className="max-w-5xl mx-auto mb-8">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-900">
            MAPA DO EVENTO
          </h2>
          <div className="rounded-lg overflow-hidden shadow-md">
            <img src="/event-map.png" alt="Mapa do Evento - Setores" className="w-full h-auto" />
          </div>
        </div>

        {/* Tickets Section */}
        <div id="ingressos" className="max-w-5xl mx-auto mb-8">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-900">
            {loading ? <span className="flex items-center justify-center gap-2">
                CARREGANDO SETORES <Loader2 className="h-6 w-6 animate-spin" />
              </span> : "INGRESSOS"}
          </h2>

          {!loading && <div className="space-y-4">
              {ticketSectors.map(sector => {
            const isExpanded = expandedSectors[sector.id];
            const lowestPrice = Math.min(...sector.variants.map(v => v.price));
            return <div key={sector.id} className={`shadow rounded-lg overflow-hidden transition-colors ${isExpanded ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <button onClick={() => toggleSector(sector.id)} className="w-full flex items-center justify-between p-4 hover:opacity-90 transition-opacity">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded" style={{
                    backgroundColor: sector.color
                  }} />
                        <div className="text-left">
                          <h3 className={`font-semibold text-lg ${isExpanded ? 'text-white' : 'text-gray-900'}`}>
                            {sector.section}
                          </h3>
                          <p className={`text-sm ${isExpanded ? 'text-gray-200' : 'text-gray-500'}`}>
                            {sector.description}
                          </p>
                          <p className={`text-sm font-medium ${isExpanded ? 'text-gray-200' : 'text-gray-600'}`}>
                            a partir de {formatCurrency(lowestPrice)}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xl font-bold ${isExpanded ? 'text-white' : 'text-gray-900'}`}>
                        {isExpanded ? '−' : '+'}
                      </span>
                    </button>

                    {isExpanded && <div className="bg-gray-100 px-4 py-4 space-y-4">
                        {sector.variants.map(variant => <div key={variant.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                          <div className="space-y-1 mb-3">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Ingresso:</span> {sector.section} ({variant.name})
                              </p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Lote:</span> 1. LOTE
                              </p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Valor:</span> {formatCurrency(variant.price)} + {formatCurrency((variant as TicketVariantWithFee).fee)} de taxa
                              </p>
                            </div>

                            <div className="flex items-center justify-end gap-2 bg-white rounded-lg p-2">
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-gray-100" onClick={() => updateQuantity(variant.id, -1)} disabled={!cart[variant.id] || cart[variant.id] === 0}>
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-12 text-center font-bold text-gray-900">
                                {cart[variant.id] || 0}
                              </span>
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-gray-100" onClick={() => updateQuantity(variant.id, 1)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>)}
                      </div>}
                  </div>;
          })}
            </div>}
        </div>

        <Separator className="my-8 max-w-5xl mx-auto" />

        {/* Event Info */}
        <div id="info" className="max-w-5xl mx-auto mb-8">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-900">
            INFORMAÇÕES
          </h2>

          <div className="bg-gray-100 rounded-lg p-6 md:p-8 space-y-6">
            <div>
              <p className="font-bold underline text-primary">HENRIQUE E JULIANO NATTAN- AHH VERÃO</p>
              <p className="font-bold underline text-blue-600">INFORMATIVO DO SHOW</p>
              <p className="text-gray-600">_______________________________________________</p>
              <p className="text-gray-800"><strong>02 DE JANEIRO DE 2026</strong></p>
              <p className="text-gray-800"><strong>ARENA OPEN</strong></p>
              <p className="text-gray-800"><strong>21H - ABERTURA DOS PORTÕES</strong></p>
              <p className="text-gray-800"><strong>00H - INÍCIO DOS SHOWS</strong></p>
            </div>

            <div>
              <p className="text-gray-600">_______________________________________________</p>
              <p className="font-bold text-blue-600 underline">CLASSIFICAÇÃO</p>
              <p className="text-gray-800"><strong>Setores: Pista e Vip</strong> (Menores com até 15 anos completos, somente acompanhados dos pais. Menores, com 16 e 17 anos, desacompanhados dos pais, deverão apresentar Autorização com assinatura reconhecida em cartório). Não é permitida a entrada de menores de 18 anos no setor Premium Open Bar.</p>
              <p className="text-gray-800 mt-2"><strong>OBS: É EXPRESSAMENTE PROIBIDO CONSUMO E VENDA DE BEBIDAS ALCOÓLICAS PARA MENORES DE 18 ANOS.</strong></p>
            </div>

            <Separator />

            <div>
              <p className="font-bold text-blue-600 underline mb-2">DESCRITIVO DOS SETORES</p>
              <div className="space-y-4 text-gray-800">
                <div>
                  <p className="font-bold text-yellow-600">- FRONTSTAGE OPEN FOOD</p>
                  <p><strong>•Espaço limitado, exclusivo e privilegiado com acesso à frente do palco;</strong></p>
                  <p><strong>•Ao entrar no evento você receberá um copo exclusivo do setor;</strong></p>
                  <p><strong>•Open Food completo com: Massas, risotos e doces;</strong></p>
                  <p><strong>•Área de convivência;</strong></p>
                  <p><strong>•Bares e banheiros no setor.</strong></p>
                  <p>*Serviço de open food da abertura dos portões até o término dos shows nacionais.</p>
                </div>

                <div>
                  <p className="font-bold text-purple-600">- PREMIUM OPEN BAR</p>
                  <p><strong>•Open Bar de Água, cerveja, refrigerante, suco, vodka;</strong></p>
                  <p>*Open bar da abertura dos portões até o término dos shows nacionais.</p>
                  <p><strong>•Entrada exclusiva;</strong></p>
                  <p><strong>•Acesso à frente do palco;</strong></p>
                  <p><strong>•Banheiros exclusivos no setor;</strong></p>
                  <p><strong>•Área de Convivência com 2.000m², exclusivo do Setor Premium, contendo:</strong></p>
                  <p><strong>•Ambiente coberto e climatizado;</strong></p>
                  <p><strong>•Lounge para descanso;</strong></p>
                  <p><strong>•Transmissão Simultânea dos Shows em Telão de LED.</strong></p>
                </div>

                <div>
                  <p className="font-bold text-blue-600">- VIP</p>
                  <p><strong>•Visão frontal do palco;</strong></p>
                  <p><strong>•Acesso à passarela;</strong></p>
                  <p><strong>•Área de convivência;</strong></p>
                  <p><strong>•Banheiros exclusivos no setor;</strong></p>
                </div>

                <div>
                  <p className="font-bold text-green-600">PISTA</p>
                  <p><strong>•Visão frontal do palco;</strong></p>
                  <p><strong>•Área de convivência;</strong></p>
                  <p><strong>•Setor com o menor custo;</strong></p>
                  <p><strong>•Bares e banheiros no setor;</strong></p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="font-bold text-blue-600 underline mb-2">INFORMAÇÕES IMPORTANTES:</p>
              <div className="space-y-3 text-gray-800">
                <p><strong>Este evento poderá ser gravado, filmado ou fotografado.</strong> Ao participar do evento o portador do ingresso concorda e autoriza a utilização gratuita de sua imagem por prazo indeterminado.</p>
                <p><strong>É proibido a entrada no evento com copos, latas, cadeiras, bancos, objetos pontiagudos e/ou cortantes, guarda-chuvas, armas de fogo, cigarros eletrônicos, dispositivos explosivos, objetos de vidro e/ou metal, drones,</strong> e itens que possam ser utilizados para marketing de emboscada.</p>
                <p><strong>Para sua segurança este evento conta com Guarda-volumes,</strong> não hesite em utilizar para guardar seus pertences. Cuide dos seus pertences, não nos responsabilizamos por objetos perdidos durante o evento.</p>
                <p><strong>Leia com atenção os termos de compra antes de realizar a compra.</strong></p>
                <p><strong>A entrada de menores é proibida nas áreas de Open Bar,</strong> e a GDO Produções se reserva o direito de não reembolsar ingressos adquiridos para esses setores, considerando a prévia informação sobre a impossibilidade de acesso de menores, mesmo que acompanhados por seus responsáveis.</p>
                <p><strong>Não há circulação de público entre os setores, exceto equipe em trabalho.</strong></p>
                <p><strong>Chegue cedo, evite filas, e divirta-se.</strong></p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="font-bold text-blue-600 underline mb-2">ESTE SHOW VAI TER COPO ECOLÓGICO!</p>
              <p className="text-gray-800"><strong>São copos 100% recicláveis, resistentes e duráveis produzidos com matéria prima (PP)*</strong></p>
              <p className="text-gray-800 mt-2"><strong>Você deverá adquirir para consumir bebidas no evento. Ao final do evento, a escolha é sua: ou devolve e é ressarcido ou leva para casa de recordação!?</strong></p>
              <p className="text-gray-800 mt-2"><strong>Nosso objetivo é sempre reduzir o consumo de plásticos e lixo no evento, visando a importância da sustentabilidade.</strong></p>
              <p className="text-gray-800 mt-2"><strong>Então se liga: NÃO TEREMOS COPOS DE PLÁSTICO DISPONÍVEIS EM NENHUM SETOR DO EVENTO</strong></p>
              <p className="text-gray-600 mt-2 text-sm">*(PP) O polipropileno é um dos plásticos que não faz mal à saúde.</p>
            </div>

            <Separator />

            <div className="text-center text-sm text-gray-600">
              <p className="font-medium">CONTATO ATENDIMENTO</p>
              <p>(48) 98820-5632</p>
              <p>@gdoproducoes</p>
            </div>
          </div>
        </div>

        <Separator className="my-8 max-w-5xl mx-auto" />

        {/* Sales Rules */}
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

        {/* Location */}
        <div id="localizacao" className="max-w-5xl mx-auto mb-8">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-900">
            LOCALIZAÇÃO
          </h2>
          <Separator className="mb-6" />
          <div className="aspect-video rounded-lg overflow-hidden shadow-md">
            <iframe src={eventData.mapsEmbedUrl} className="w-full h-full" style={{
            border: 0
          }} allowFullScreen loading="lazy" />
          </div>
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

      {/* Fixed Cart */}
      {getTotalItems() > 0 && <div className="fixed bottom-0 left-0 right-0 shadow-2xl z-50" style={{
      backgroundColor: 'rgba(29, 115, 28, 0.95)'
    }}>
          <div className="container mx-auto px-4 py-3">
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
        </div>}
    </div>;
};
export default Ingressos;