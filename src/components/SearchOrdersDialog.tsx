import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SearchOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EventData {
  name: string;
  location: string;
  date: string;
  time: string;
  openingTime?: string;
  coverUrl?: string;
}

const SearchOrdersDialog = ({ open, onOpenChange }: SearchOrdersDialogProps) => {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const handleInputChange = (value: string) => {
    // Check if it contains any letter (email) or just numbers (CPF)
    const hasLetter = /[a-zA-Z]/.test(value);
    
    if (hasLetter || value.includes('@')) {
      // It's an email - allow free text input
      setSearchValue(value);
    } else {
      // It's a CPF - format as numbers only
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 11) {
        setSearchValue(formatCPF(numbers));
      }
    }
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      toast.error("Digite um CPF ou e-mail para buscar");
      return;
    }

    setIsLoading(true);

    try {
      const isEmail = searchValue.includes('@');
      const searchField = isEmail ? 'customer_email' : 'customer_cpf';
      const searchQuery = isEmail ? searchValue.trim() : searchValue.replace(/\D/g, '');

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq(searchField, searchQuery)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching orders:', error);
        toast.error("Erro ao buscar pedidos");
        return;
      }

      if (!data || data.length === 0) {
        toast.error("Nenhum pedido encontrado com essas informações");
        return;
      }

      // Fetch event data for the first order with event_id
      let eventData: EventData | undefined = undefined;
      
      // Find the first order with an event_id
      const orderWithEvent = data.find(order => order.event_id);
      
      if (orderWithEvent?.event_id) {
        const { data: eventResult, error: eventError } = await supabase
          .from('events')
          .select('name, location, event_date, event_time, opening_time, cover_url')
          .eq('id', orderWithEvent.event_id)
          .maybeSingle();
        
        if (!eventError && eventResult) {
          eventData = {
            name: eventResult.name,
            location: eventResult.location,
            date: eventResult.event_date,
            time: eventResult.event_time,
            openingTime: eventResult.opening_time || undefined,
            coverUrl: eventResult.cover_url || undefined
          };
        }
      }

      // Navigate to orders page with the found orders and event data
      navigate('/meus-pedidos', { state: { orders: data, searchQuery: searchValue, eventData } });
      onOpenChange(false);
      setSearchValue("");
    } catch (err) {
      console.error('Error:', err);
      toast.error("Erro ao buscar pedidos");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black text-white border-gray-800 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            Buscar Pedidos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <p className="text-gray-400 text-sm text-center">
            Digite seu CPF ou e-mail para encontrar seus pedidos
          </p>

          <div className="space-y-2">
            <Label htmlFor="search" className="text-gray-300">
              CPF ou E-mail
            </Label>
            <Input
              id="search"
              placeholder="000.000.000-00 ou email@exemplo.com"
              value={searchValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>

          <Button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-semibold py-6"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="h-5 w-5 mr-2" />
                Buscar Pedidos
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchOrdersDialog;