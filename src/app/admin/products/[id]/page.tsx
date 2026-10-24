import { Suspense } from "react";
import AdminApp from "../../wireframe-ui";

export const instant = false;

interface Props {
  params: Promise<{ id: string }>;
}

async function EditGarmentInner({ params }: Props) {
  const { id } = await params;
  return <AdminApp initialPage="editor" initialProductId={id} />;
}

export default function AdminEditGarmentPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6b7280",
            fontFamily: "var(--font-geist-sans), sans-serif",
          }}
        >
          Loading garment editor...
        </div>
      }
    >
      <EditGarmentInner {...props} />
    </Suspense>
  );
}
