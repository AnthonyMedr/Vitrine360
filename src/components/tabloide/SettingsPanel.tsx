import { useRef, useState } from "react";
import {
  Settings,
  X,
  RotateCcw,
  Upload,
  Plus,
  Trash2,
  Maximize2,
  CalendarClock,
  WifiOff,
} from "lucide-react";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { useSettings, type BadgeTone, type ScheduledCampaign } from "@/context/SettingsContext";

const TONES: { id: BadgeTone; label: string; cls: string }[] = [
  { id: "action", label: "Laranja", cls: "bg-action text-action-foreground" },
  { id: "highlight", label: "Amarelo", cls: "bg-highlight text-highlight-foreground" },
  { id: "brand", label: "Marca", cls: "bg-brand text-brand-foreground" },
  { id: "dark", label: "Escuro", cls: "bg-foreground text-background" },
  { id: "whatsapp", label: "Verde", cls: "bg-whatsapp text-whatsapp-foreground" },
];

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const { settings, update, reset } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => update({ logoUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Configurações do tablóide"
        className="fixed bottom-5 left-5 z-40 inline-flex items-center justify-center size-12 bg-foreground text-background rounded-full shadow-pop hover:scale-105 active:scale-95 transition-transform opacity-50 hover:opacity-100"
      >
        <Settings className="size-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex justify-end bg-foreground/50 backdrop-blur-sm animate-reveal"
          onClick={() => setOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md h-full bg-card text-card-foreground overflow-y-auto shadow-pop"
          >
            <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-display text-lg font-extrabold tracking-tight">
                  Configurações
                </h2>
                <p className="text-xs text-muted-foreground">
                  Personalize o catálogo sem mexer no código.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 hover:bg-surface rounded-full"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              <Section title="Identidade">
                <Field label="Nome da loja">
                  <input
                    value={settings.brand}
                    onChange={(e) => update({ brand: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Tagline">
                  <input
                    value={settings.tagline}
                    onChange={(e) => update({ tagline: e.target.value })}
                    className="input"
                  />
                </Field>

                <Field label="Logo">
                  <div className="flex items-center gap-3">
                    <div className="size-16 bg-brand rounded-xl p-2 shrink-0 grid place-items-center">
                      <StoreLogo
                        brand={settings.brand}
                        logoUrl={settings.logoUrl}
                        imageClassName="max-h-full max-w-full"
                        fallbackClassName="size-12 bg-brand-foreground/10 text-brand-foreground"
                      />
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-2 bg-surface hover:bg-secondary px-3 py-2 rounded-lg text-sm font-bold"
                    >
                      <Upload className="size-4" /> Trocar
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0])}
                    />
                  </div>
                </Field>
              </Section>

              <Section title="Contato e loja">
                <Field label="Número WhatsApp (DDI, só números)">
                  <input
                    value={settings.whatsappNumber}
                    onChange={(e) => update({ whatsappNumber: e.target.value.replace(/\D/g, "") })}
                    placeholder="5511999999999"
                    className="input"
                  />
                </Field>
                <Field label="Como exibir o telefone">
                  <input
                    value={settings.whatsappLabel}
                    onChange={(e) => update({ whatsappLabel: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="input"
                  />
                </Field>
                <Field label="Endereço">
                  <input
                    value={settings.address}
                    onChange={(e) => update({ address: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Horário de funcionamento">
                  <input
                    value={settings.hours}
                    onChange={(e) => update({ hours: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Instagram">
                  <input
                    value={settings.instagram}
                    onChange={(e) => update({ instagram: e.target.value })}
                    className="input"
                  />
                </Field>
              </Section>

              <Section title="Cores">
                <Field label="Cor de ação (CTAs)">
                  <ColorInput
                    value={settings.actionColor}
                    onChange={(v) => update({ actionColor: v })}
                  />
                </Field>
                <Field label="Cor do selo promocional">
                  <ColorInput
                    value={settings.highlightColor}
                    onChange={(v) => update({ highlightColor: v })}
                  />
                </Field>
              </Section>

              <Section title="Modo Totem (kiosk)">
                <label className="flex items-center justify-between gap-3 bg-surface p-3 rounded-lg">
                  <div>
                    <p className="text-sm font-bold">Ativar modo kiosk</p>
                    <p className="text-xs text-muted-foreground">
                      Botões maiores, sem seleção de texto e tela de descanso após inatividade.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.kioskMode}
                    onChange={(e) => update({ kioskMode: e.target.checked })}
                    className="size-5 accent-current"
                  />
                </label>
                <Field label={`Tela de descanso após ${settings.idleTimeoutSec}s de inatividade`}>
                  <input
                    type="range"
                    min={30}
                    max={300}
                    step={10}
                    value={settings.idleTimeoutSec}
                    onChange={(e) => update({ idleTimeoutSec: Number(e.target.value) })}
                    className="w-full accent-action"
                  />
                </Field>
                <button
                  onClick={toggleFullscreen}
                  className="inline-flex items-center gap-2 bg-foreground text-background px-3 py-2 rounded-lg text-sm font-bold"
                >
                  <Maximize2 className="size-4" /> Tela cheia
                </button>
              </Section>

              <Section title="Selos promocionais">
                <p className="text-xs text-muted-foreground mb-3">
                  Estes selos ficam disponíveis para uso nos produtos.
                </p>
                <div className="space-y-2">
                  {settings.badgePresets.map((b, i) => (
                    <div key={b.id} className="flex items-center gap-2 bg-surface p-2 rounded-lg">
                      <input
                        value={b.label}
                        onChange={(e) => {
                          const arr = [...settings.badgePresets];
                          arr[i] = { ...b, label: e.target.value };
                          update({ badgePresets: arr });
                        }}
                        className="input flex-1 !py-1.5 text-xs"
                      />
                      <select
                        value={b.tone}
                        onChange={(e) => {
                          const arr = [...settings.badgePresets];
                          arr[i] = { ...b, tone: e.target.value as BadgeTone };
                          update({ badgePresets: arr });
                        }}
                        className="input !py-1.5 text-xs w-28"
                      >
                        {TONES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded uppercase ${
                          TONES.find((t) => t.id === b.tone)?.cls
                        }`}
                      >
                        {b.label || "—"}
                      </span>
                      <button
                        onClick={() =>
                          update({ badgePresets: settings.badgePresets.filter((_, j) => j !== i) })
                        }
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                        aria-label="Remover selo"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    update({
                      badgePresets: [
                        ...settings.badgePresets,
                        { id: `b${Date.now()}`, label: "Novo", tone: "highlight" },
                      ],
                    })
                  }
                  className="mt-3 inline-flex items-center gap-2 text-xs font-bold bg-surface hover:bg-secondary px-3 py-2 rounded-lg"
                >
                  <Plus className="size-3.5" /> Adicionar selo
                </button>
              </Section>

              <Section title="Agendamento de campanhas">
                <p className="text-xs text-muted-foreground mb-2">
                  Programe quando cada destaque aparece na faixa superior do catálogo. A campanha
                  ativa do dia é exibida automaticamente.
                </p>
                <div className="space-y-3">
                  {settings.campaigns.map((c, i) => (
                    <div key={c.id} className="bg-surface p-3 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="size-4 text-action shrink-0" />
                        <input
                          value={c.name}
                          onChange={(e) =>
                            updateCampaign(settings.campaigns, i, { name: e.target.value }, update)
                          }
                          className="input flex-1 !py-1.5 text-xs font-bold"
                          placeholder="Nome interno"
                        />
                        <label className="inline-flex items-center gap-1 text-[11px] font-bold">
                          <input
                            type="checkbox"
                            checked={c.enabled}
                            onChange={(e) =>
                              updateCampaign(
                                settings.campaigns,
                                i,
                                { enabled: e.target.checked },
                                update,
                              )
                            }
                            className="accent-current"
                          />
                          Ativa
                        </label>
                        <button
                          onClick={() =>
                            update({ campaigns: settings.campaigns.filter((_, j) => j !== i) })
                          }
                          className="p-1.5 text-muted-foreground hover:text-destructive"
                          aria-label="Remover campanha"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <input
                        value={c.badgeLabel}
                        onChange={(e) =>
                          updateCampaign(
                            settings.campaigns,
                            i,
                            { badgeLabel: e.target.value },
                            update,
                          )
                        }
                        className="input !py-1.5 text-xs"
                        placeholder="Texto do selo (ex.: OFERTA DA SEMANA)"
                      />
                      <input
                        value={c.message}
                        onChange={(e) =>
                          updateCampaign(settings.campaigns, i, { message: e.target.value }, update)
                        }
                        className="input !py-1.5 text-xs"
                        placeholder="Mensagem da faixa"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[11px] font-semibold">
                          Início
                          <input
                            type="date"
                            value={c.startDate}
                            onChange={(e) =>
                              updateCampaign(
                                settings.campaigns,
                                i,
                                { startDate: e.target.value },
                                update,
                              )
                            }
                            className="input !py-1.5 text-xs mt-1"
                          />
                        </label>
                        <label className="text-[11px] font-semibold">
                          Fim
                          <input
                            type="date"
                            value={c.endDate}
                            onChange={(e) =>
                              updateCampaign(
                                settings.campaigns,
                                i,
                                { endDate: e.target.value },
                                update,
                              )
                            }
                            className="input !py-1.5 text-xs mt-1"
                          />
                        </label>
                      </div>
                      <select
                        value={c.tone}
                        onChange={(e) =>
                          updateCampaign(
                            settings.campaigns,
                            i,
                            { tone: e.target.value as BadgeTone },
                            update,
                          )
                        }
                        className="input !py-1.5 text-xs"
                      >
                        {TONES.map((t) => (
                          <option key={t.id} value={t.id}>
                            Cor: {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    update({
                      campaigns: [
                        ...settings.campaigns,
                        {
                          id: `c${Date.now()}`,
                          name: "Nova campanha",
                          badgeLabel: "DESTAQUE",
                          message: `Aproveite a nova campanha de ${settings.brand}.`,
                          tone: "action",
                          startDate: new Date().toISOString().slice(0, 10),
                          endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                          enabled: true,
                        },
                      ],
                    })
                  }
                  className="mt-3 inline-flex items-center gap-2 text-xs font-bold bg-surface hover:bg-secondary px-3 py-2 rounded-lg"
                >
                  <Plus className="size-3.5" /> Adicionar campanha
                </button>
              </Section>

              <Section title="Modo offline">
                <label className="flex items-center justify-between gap-3 bg-surface p-3 rounded-lg">
                  <div>
                    <p className="text-sm font-bold flex items-center gap-2">
                      <WifiOff className="size-4" /> Cache para o totem
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Mantém imagens e catálogo funcionando mesmo com internet instável. Ativa
                      apenas no site publicado (não funciona no preview).
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.offlineMode}
                    onChange={(e) => update({ offlineMode: e.target.checked })}
                    className="size-5 accent-current"
                  />
                </label>
              </Section>

              <div className="pt-2 border-t border-border">
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-destructive"
                >
                  <RotateCcw className="size-3.5" /> Restaurar padrões
                </button>
              </div>
            </div>

            <style>{`
              .input {
                width: 100%;
                background: var(--color-surface);
                color: var(--color-foreground);
                border: 1px solid var(--color-border);
                padding: 0.5rem 0.75rem;
                border-radius: 0.5rem;
                font-size: 0.875rem;
                outline: none;
              }
              .input:focus { border-color: var(--color-action); }
            `}</style>
          </aside>
        </div>
      )}
    </>
  );
}

function updateCampaign(
  campaigns: ScheduledCampaign[],
  index: number,
  patch: Partial<ScheduledCampaign>,
  update: (p: { campaigns: ScheduledCampaign[] }) => void,
) {
  const next = [...campaigns];
  next[index] = { ...next[index], ...patch };
  update({ campaigns: next });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-widest font-bold text-action mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-foreground/80 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-10 rounded-lg border border-border bg-card cursor-pointer"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input flex-1 font-mono uppercase"
      />
    </div>
  );
}
