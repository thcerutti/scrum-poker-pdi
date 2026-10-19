import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import ElectricScooterIcon from "@mui/icons-material/ElectricScooter";
import FlightIcon from "@mui/icons-material/Flight";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PedalBikeIcon from "@mui/icons-material/PedalBike";
import SkateboardingIcon from "@mui/icons-material/Skateboarding";
import TwoWheelerIcon from "@mui/icons-material/TwoWheeler";
import type { SvgIconComponent } from "@mui/icons-material";
import type { CardValue } from "@/lib/deck";

export interface CardInfo {
  label: string;
  hint: string;
  Icon: SvgIconComponent;
}

/** Quanto mais partes o veículo tem, maior a entrega. A cor vem do acento do
 *  segmento (uma família por tela), então os ícones não têm cor própria. */
export const CARD_INFO: Record<CardValue, CardInfo> = {
  "1": { label: "Skate", hint: "Poucas partes, entrega trivial", Icon: SkateboardingIcon },
  "2": { label: "Patinete", hint: "Simples, com alguma montagem", Icon: ElectricScooterIcon },
  "3": { label: "Bicicleta", hint: "Algumas partes integradas", Icon: PedalBikeIcon },
  "5": { label: "Moto", hint: "Motor, várias peças conectadas", Icon: TwoWheelerIcon },
  "8": { label: "Carro", hint: "Muitas partes e integrações", Icon: DirectionsCarIcon },
  "13": { label: "Caminhão", hint: "Grande, pesado, muito trabalho", Icon: LocalShippingIcon },
  "21": { label: "Avião", hint: "Enorme: considere quebrar a história", Icon: FlightIcon },
  coffee: { label: "Pausa", hint: "Preciso de um café", Icon: LocalCafeIcon },
};
