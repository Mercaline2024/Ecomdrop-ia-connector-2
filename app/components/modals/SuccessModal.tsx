import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { CheckCircle2 } from "lucide-react";

interface SuccessModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  buttonText?: string;
}

export function SuccessModal({
  open,
  onClose,
  title = "Listo!",
  description = "Producto importado con éxito",
  buttonText = "Cool",
}: SuccessModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {title}
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600 mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center mt-6">
          <Button
            onClick={onClose}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-2 rounded-md font-medium"
          >
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

