import { useState } from "react";
import { Menu, Home, HelpCircle, Search } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import SearchOrdersDialog from "./SearchOrdersDialog";
import { toast } from "sonner";

const Navbar = () => {
  const [searchOrdersOpen, setSearchOrdersOpen] = useState(false);

  const handleHelpClick = () => {
    toast.info("Envie sua dúvida para o email: sac@guicheweb.com.br", {
      duration: 5000,
    });
  };

  return (
    <nav className="w-full bg-black text-white py-3 px-4 fixed top-0 left-0 right-0 z-50">
      <div className="flex justify-between items-center max-w-full">
        <div className="flex items-center">
          <img
            src="https://s3.guicheweb.com.br/nova_marca/logogw.png"
            alt="Guichê Web"
            className="h-8"
          />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <button className="flex items-center justify-center w-12 h-12 rounded border-2 border-yellow-600 hover:bg-yellow-600/10 transition-colors">
              <Menu className="h-6 w-6 text-white" />
            </button>
          </SheetTrigger>
          <SheetContent side="top" className="bg-black text-white border-b-gray-800 p-0 h-auto">
            <div className="flex flex-col">
              <div className="p-6 border-b border-gray-800">
                <img
                  src="https://s3.guicheweb.com.br/nova_marca/logogw.png"
                  alt="Guichê Web"
                  className="h-8"
                />
              </div>

              <div className="py-4">
                <nav className="flex flex-col gap-1">
                  <Link
                    to="/"
                    className="flex items-center gap-3 px-6 py-4 hover:bg-gray-900 transition-colors"
                  >
                    <Home className="h-5 w-5" />
                    <span className="text-base">Home</span>
                  </Link>
                  <button
                    onClick={() => setSearchOrdersOpen(true)}
                    className="flex items-center gap-3 px-6 py-4 hover:bg-gray-900 transition-colors text-left w-full"
                  >
                    <Search className="h-5 w-5" />
                    <span className="text-base">Buscar Pedidos</span>
                  </button>
                  <button
                    onClick={handleHelpClick}
                    className="flex items-center gap-3 px-6 py-4 hover:bg-gray-900 transition-colors text-left w-full"
                  >
                    <HelpCircle className="h-5 w-5" />
                    <span className="text-base">Ajuda</span>
                  </button>
                </nav>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <SearchOrdersDialog open={searchOrdersOpen} onOpenChange={setSearchOrdersOpen} />
    </nav>
  );
};

export default Navbar;
