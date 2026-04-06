import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import guichewebLogoFull from "@/assets/guicheweb-logo-full.png";

interface TicketItem {
  name: string;
  quantity: number;
  price: number;
}

interface EventData {
  name: string;
  location: string;
  date: string;
  time: string;
  openingTime?: string;
  coverUrl?: string;
}

interface TicketViewProps {
  orderId: string;
  transactionId: string;
  customerName: string;
  customerCpf: string;
  customerEmail: string;
  items: TicketItem[];
  totalAmount: number;
  paidAt: string;
  ticketIndex: number;
  totalTickets: number;
  eventData?: EventData;
  useFixedCover?: boolean;
  fixedCoverUrl?: string;
}

const TicketView = ({
  orderId,
  transactionId,
  customerName,
  customerCpf,
  customerEmail,
  items,
  totalAmount,
  paidAt,
  ticketIndex,
  totalTickets,
  eventData,
  useFixedCover = false,
  fixedCoverUrl,
}: TicketViewProps) => {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [ticketCode, setTicketCode] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [safeCoverUrl, setSafeCoverUrl] = useState<string | undefined>(undefined);

  // Generate unique codes for each ticket
  useEffect(() => {
    const baseCode = transactionId.replace(/\D/g, '').slice(0, 8);
    const ticketNum = (ticketIndex + 1).toString().padStart(2, '0');
    const uniqueCode = `${baseCode}${Date.now().toString().slice(-4)}${ticketNum}`;
    setTicketCode(uniqueCode);
    setOrderNumber(`${orderId.slice(0, 8).toUpperCase()}/${ticketIndex + 1}`);
  }, [transactionId, ticketIndex, orderId]);

  // Generate QR Code
  useEffect(() => {
    if (qrRef.current && ticketCode) {
      QRCode.toCanvas(qrRef.current, ticketCode, {
        width: 100,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    }
  }, [ticketCode]);

  // Generate Barcode
  useEffect(() => {
    if (barcodeRef.current && ticketCode) {
      JsBarcode(barcodeRef.current, ticketCode, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: false,
        margin: 0,
      });
    }
  }, [ticketCode]);

  const formatCPF = (cpf: string) => {
    const numbers = cpf.replace(/\D/g, '');
    return `${numbers.slice(0, 3)}.****${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const formatEmail = (email: string) => {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}*****@${domain}`;
  };

  const paidDate = new Date(paidAt);

  // Use dynamic event data or fallback to defaults
  const eventName = eventData?.name || "Evento";
  const eventLocation = eventData?.location || "Local do Evento";
  
  // Format event date from database format (YYYY-MM-DD) to display format
  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };
  
  const eventDate = eventData?.date ? formatEventDate(eventData.date) : "";
  const eventTime = eventData?.time?.slice(0, 5) || "";
  const openingTime = eventData?.openingTime?.slice(0, 5) || eventTime;
  const coverUrl = useFixedCover ? fixedCoverUrl : eventData?.coverUrl;

  // Prepare a safe cover URL as Data URL to avoid CORS issues when generating PDFs
  useEffect(() => {
    if (!coverUrl) {
      setSafeCoverUrl(undefined);
      return;
    }

    // If it's already a Data URL, just use it
    if (coverUrl.startsWith("data:")) {
      setSafeCoverUrl(coverUrl);
      return;
    }

    let cancelled = false;

    const prepareCover = async () => {
      const setFallback = () => {
        if (!cancelled) {
          setSafeCoverUrl(coverUrl);
        }
      };

      try {
        // Try to fetch the image directly
        const response = await fetch(coverUrl);
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();

          reader.onloadend = () => {
            if (cancelled) return;

            if (typeof reader.result === "string") {
              setSafeCoverUrl(reader.result);
            } else {
              setFallback();
            }
          };

          reader.readAsDataURL(blob);
          return;
        }
      } catch (error) {
        console.error("Erro ao preparar a imagem de capa do evento:", error);
      }

      // Fallback: use backend image proxy to bypass CORS and get a Data URL
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          setFallback();
          return;
        }

        const functionsBase = supabaseUrl.replace(".supabase.co", ".functions.supabase.co");
        const proxyUrl = `${functionsBase}/functions/v1/image-proxy?url=${encodeURIComponent(coverUrl)}`;

        const proxyResponse = await fetch(proxyUrl);
        if (!proxyResponse.ok) {
          setFallback();
          return;
        }

        const result = (await proxyResponse.json()) as { dataUrl?: string };
        if (!cancelled) {
          if (result.dataUrl && typeof result.dataUrl === "string") {
            setSafeCoverUrl(result.dataUrl);
          } else {
            setFallback();
          }
        }
      } catch (proxyError) {
        console.error("Erro ao carregar imagem via proxy:", proxyError);
        setFallback();
      }
    };

    prepareCover();

    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  // Get ticket name from items
  const ticketName = items[0]?.name || "Ingresso";
  const ticketPrice = items[0]?.price || totalAmount;

  return (
    <div
      data-ticket-root
      className="bg-white text-black p-4 sm:p-6 max-w-md sm:max-w-3xl mx-auto"
      id={`ticket-${ticketIndex}`}
    >
      {/* Header with Logo and Favorecido */}
      <div className="flex justify-between items-start mb-4 gap-4">
        <div>
          <p className="text-sm text-gray-600">
            {format(paidDate, "dd/MM/yy, HH:mm", { locale: ptBR })}
          </p>
          <p className="text-sm text-gray-500">E-Ticket - Guichê Web</p>
        </div>
        <img src={guichewebLogoFull} alt="Guichê Web" className="h-10" />
        <div className="text-right">
          <p className="text-sm text-gray-600">Favorecido:</p>
          <p className="font-bold text-green-600 text-sm">{customerName}</p>
          <p className="text-xs text-gray-600">CPF: {formatCPF(customerCpf)}</p>
          <p className="text-xs text-gray-600">{formatEmail(customerEmail)}</p>
        </div>
      </div>

      {/* Event Title */}
      <h1 className="text-xl font-bold mb-1">{eventName}</h1>
      <p className="text-sm text-gray-600 mb-4 flex items-center gap-1">
        <span className="text-red-500">📍</span> {eventLocation}
      </p>

      {/* Main Ticket Section */}
      <div className="flex flex-row gap-4 mb-6">
        {/* Event Banner with rounded border */}
        <div className="w-48 h-32 overflow-hidden rounded-lg border-2 border-gray-300 flex-shrink-0">
          {coverUrl ? (
            <img 
              src={safeCoverUrl || coverUrl} 
              alt={eventName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-4xl">🎟️</span>
            </div>
          )}
        </div>

        {/* Ticket Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎟️</span>
            <span className="font-bold">{ticketName}</span>
          </div>
          <p className="text-sm text-gray-600 mb-1">
            📅 {eventDate}
          </p>
          <p className="text-sm text-gray-600 mb-1">
            <strong>Abertura:</strong> {openingTime} <strong>Início:</strong> {eventTime}
          </p>
          <p className="text-sm text-gray-600">
            Valor: R$ {ticketPrice.toFixed(2).replace('.', ',')}
          </p>
        </div>
      </div>

      {/* Order Details and QR Code Section */}
      <div className="grid grid-cols-3 gap-4 mb-6 border-t pt-4">
        <div>
          <p className="font-bold mb-2">PEDIDO: {orderNumber}</p>
          <p className="text-sm">{ticketName}</p>
          <p className="text-sm text-gray-600">
            Valor: R$ {ticketPrice.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-sm text-gray-600">
            Data da compra: {format(paidDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
        </div>
        <div>
          <p className="font-bold mb-2">CÓDIGO: {ticketCode}</p>
          <p className="text-sm">{customerName}</p>
          <p className="text-sm text-gray-600">CPF: {formatCPF(customerCpf)}</p>
          <p className="text-sm text-gray-600">{formatEmail(customerEmail)}</p>
        </div>
        {/* QR Code on the right */}
        <div className="flex flex-col items-end justify-start">
          <canvas ref={qrRef} className="ml-auto" />
          <p className="text-xs text-gray-600 mt-2">Pedido: {orderNumber}</p>
          <p className="text-xs text-gray-600">Código: {ticketCode}</p>
        </div>
      </div>

      {/* Important Section */}
      <div className="mb-6">
        <h2 className="font-bold text-lg mb-3">IMPORTANTE</h2>
        <ul className="text-sm text-gray-700 space-y-2">
          <li>• Ao imprimir, certifique-se que a área com o código de barras está legível e em perfeito estado.</li>
          <li>• Um documento com foto (RG, CNH) do titular informado neste ingresso poderá ser solicitado na portaria.</li>
          <li>• Não nos responsabilizamos por ingressos comprados de terceiros, bem como por cópias indevidas deste e-Ticket.</li>
          <li>• <strong>Este ingresso é válido para o portador dele em PDF ou impresso, com documento (RG, CNH) em mãos. Qualquer pessoa com este ingresso poderá utilizá-lo na entrada.</strong></li>
        </ul>
      </div>

      {/* Barcode */}
      <div className="flex flex-col items-center mt-8 border-t pt-6">
        <svg ref={barcodeRef} className="w-72" />
        <p className="text-red-600 font-bold text-sm mt-4 text-center">
          ATENÇÃO: NUNCA IMPRIMA SEM CÓDIGO DE BARRAS VISÍVEL
        </p>
      </div>
    </div>
  );
};

export default TicketView;
