import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import { StyleTest } from "@/components/style/StyleTest";
import { getLanding } from "@/lib/landing-data";

export const metadata: Metadata = {
  title: "Tu estilo y tu colorimetría",
  description: "Un test de un minuto: tus estilos y tu paleta de colores, con outfits para vos.",
};

export default function StylePage() {
  return (
    <PageTransition>
      <StyleTest pins={getLanding().pins} />
    </PageTransition>
  );
}
