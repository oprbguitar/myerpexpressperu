import { useState, type FormEvent } from "react";
import { apiIdempotent } from "../../../api";
import { Button } from "../../../components/Ui";
import { Phase3Header, ResourcePanel } from "../components/Phase3Ui";
import { usePhase3Resource } from "../usePhase3Resource";
import "../phase3.css";

interface GeocodeResult {
  candidates: Array<{
    point: { latitude: number; longitude: number };
    formattedAddress: string;
    confidence: number;
    mock: boolean;
    requiresConfirmation: boolean;
  }>;
  privacyPrecisionApplied: string;
  requiresHumanConfirmation: true;
}

export default function MapsPage() {
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [result, setResult] = useState<GeocodeResult | null>(null);
  const [message, setMessage] = useState("");
  const aggregates = usePhase3Resource<unknown>("/maps/aggregates");
  async function geocode(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const response = await apiIdempotent<GeocodeResult>("/maps/geocode", "maps-geocode", {
        address: { countryCode: "PE", freeForm: address },
        precision: "DISTRICT",
        locationKind: "BUSINESS"
      });
      setResult(response);
      const candidate = response.candidates[0];
      if (candidate) {
        setLatitude(String(candidate.point.latitude));
        setLongitude(String(candidate.point.longitude));
      } else {
        setMessage("El proveedor no devolvió candidatos. Usa coordenadas manuales.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Geocodificación no disponible. Usa coordenadas manuales.");
    }
  }
  return (
    <div className="standard-page p3-page">
      <Phase3Header
        context="Ubicaciones"
        title="Resumen geográfico"
        description="Visualiza solo agregados autorizados. La captura manual sigue disponible cuando el proveedor de mapas no está configurado."
      />
      <section className="p3-map-layout">
        <form className="p3-map-form" onSubmit={(event) => void geocode(event)}>
          <h2>Ubicar dirección</h2>
          <label><span>Dirección</span><input value={address} onChange={(event) => setAddress(event.target.value)} required /></label>
          <Button type="submit">Buscar coordenadas</Button>
          {message ? <p className="p3-warning" role="alert">{message}</p> : null}
          <div className="p3-form-grid">
            <label><span>Latitud manual</span><input type="number" step="any" min="-90" max="90" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
            <label><span>Longitud manual</span><input type="number" step="any" min="-180" max="180" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
          </div>
          {result?.candidates[0] ? <p className="p3-success">Resultado por confirmar: {result.candidates[0].formattedAddress}{result.candidates[0].mock ? " (demostración mock)" : ""}</p> : null}
        </form>
        <div className="p3-map-placeholder">
          <strong>Vista cartográfica opcional</strong>
          <p>{latitude && longitude ? `Coordenadas seleccionadas: ${latitude}, ${longitude}` : "Ingresa una dirección o coordenadas para preparar la ubicación."}</p>
          <small>La ausencia de proveedor no bloquea el registro manual.</small>
        </div>
      </section>
      <ResourcePanel title="Agregados por ubicación" state={aggregates} empty="No hay agregados geográficos disponibles." reload={aggregates.reload} />
    </div>
  );
}
