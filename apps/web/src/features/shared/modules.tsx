/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { api } from "../../api";

interface ModulesState {
  enabled: ReadonlySet<string>;
  loaded: boolean;
  refresh: () => void;
}

const ModulesContext = createContext<ModulesState>({ enabled: new Set(), loaded: false, refresh: () => {} });

/**
 * Estado de módulos habilitados, compartido por la navegación y las guardas de
 * ruta. La API sigue siendo la autoridad; esto solo evita mostrar u ofrecer
 * rutas de módulos deshabilitados. Se recarga tras cambios de activación.
 */
export function ModulesProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabled] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let active = true;
    void api<Array<{ code: string; status: string }>>("/modules")
      .then((modules) => {
        if (!active) return;
        setEnabled(new Set(modules.filter((m) => m.status === "enabled").map((m) => m.code)));
        setLoaded(true);
      })
      .catch(() => {
        if (active) { setEnabled(new Set()); setLoaded(true); }
      });
    return () => { active = false; };
  }, [nonce]);
  return (
    <ModulesContext.Provider value={{ enabled, loaded, refresh: () => setNonce((n) => n + 1) }}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules(): ModulesState {
  return useContext(ModulesContext);
}

/**
 * Guarda de ruta por módulo. Si el módulo está deshabilitado para la empresa,
 * muestra un mensaje controlado en vez de cargar la pantalla. No es el control
 * de seguridad: la API rechaza igualmente con MODULE_DISABLED.
 */
export function ModuleRoute({ module, children }: PropsWithChildren<{ module: string }>) {
  const { enabled, loaded } = useModules();
  if (loaded && !enabled.has(module)) {
    return (
      <section className="standard-page" role="note">
        <h1>Módulo no disponible</h1>
        <p>Este módulo está actualmente deshabilitado para la empresa seleccionada.</p>
      </section>
    );
  }
  return <>{children}</>;
}
