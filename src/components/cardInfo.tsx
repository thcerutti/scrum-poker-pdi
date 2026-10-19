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
  iconColor: string;
}

/** Quanto mais partes o veículo tem, maior a entrega. */
export const CARD_INFO: Record<CardValue, CardInfo> = {
  "1": { label: "Skate", hint: "Poucas partes, entrega trivial", Icon: SkateboardingIcon, iconColor: "#455A64" },
  "2": { label: "Patinete", hint: "Simples, com alguma montagem", Icon: ElectricScooterIcon, iconColor: "#E53935" },
  "3": { label: "Bicicleta", hint: "Algumas partes integradas", Icon: PedalBikeIcon, iconColor: "#F4511E" },
  "5": { label: "Moto", hint: "Motor, várias peças conectadas", Icon: TwoWheelerIcon, iconColor: "#00897B" },
  "8": { label: "Carro", hint: "Muitas partes e integrações", Icon: DirectionsCarIcon, iconColor: "#1E88E5" },
  "13": { label: "Caminhão", hint: "Grande, pesado, muito trabalho", Icon: LocalShippingIcon, iconColor: "#6D4C41" },
  "21": { label: "Avião", hint: "Enorme: considere quebrar a história", Icon: FlightIcon, iconColor: "#FB8C00" },
  coffee: { label: "Pausa", hint: "Preciso de um café", Icon: LocalCafeIcon, iconColor: "#5D4037" },
};
