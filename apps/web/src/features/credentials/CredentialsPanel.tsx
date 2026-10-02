import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  ApifyUsage,
  CheckCatalogItem,
  CredentialStatus,
} from '@osint-pier/contracts';
import {
  getApifyUsage,
  listCheckSettings,
  listCredentials,
  removeCredential,
  saveCredential,
  setCheckEnabled,
} from '../../api/client';

function unavailableApifyUsage(): ApifyUsage {
  return {
    status: 'unavailable',
    guardThresholdPercent: 80,
    guardActive: true,
    guardReason:
      'A cota não pôde ser verificada; as ferramentas Apify permanecem bloqueadas.',
  };
}

export function CredentialsPanel() {
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<CredentialStatus[] | null>(
    null,
  );
  const [checkSettings, setCheckSettings] = useState<CheckCatalogItem[] | null>(
    null,
  );
  const [apifyUsage, setApifyUsage] = useState<ApifyUsage | null>(null);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingCheckIds, setPendingCheckIds] = useState<Set<string>>(
    () => new Set(),
  );

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      const [nextCredentials, nextCheckSettings, nextApifyUsage] =
        await Promise.all([
          listCredentials(),
          listCheckSettings(),
          getApifyUsage().catch(unavailableApifyUsage),
        ]);
      setCredentials(nextCredentials);
      setCheckSettings(nextCheckSettings);
      setApifyUsage(nextApifyUsage);
    } catch (error) {
      setCredentials(null);
      setApifyUsage(null);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir o cofre.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await saveCredential(name.trim().toUpperCase(), value);
      setName('');
      setValue('');
      setCredentials(await listCredentials());
      setMessage('Credencial armazenada com segurança.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a credencial.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(credentialName: string) {
    if (!window.confirm(`Remover ${credentialName} do cofre interno?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await removeCredential(credentialName);
      setCredentials(await listCredentials());
      setMessage('Credencial removida do cofre.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível remover a credencial.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleCheck(
    check: CheckCatalogItem,
    nextEnabled: boolean,
  ) {
    setPendingCheckIds((current) => new Set(current).add(check.id));
    setCheckSettings(
      (current) =>
        current?.map((item) =>
          item.id === check.id ? { ...item, enabled: nextEnabled } : item,
        ) ?? null,
    );
    setBusy(true);
    setMessage(null);
    try {
      const updated = await setCheckEnabled(check.id, nextEnabled);
      setCheckSettings(
        (current) =>
          current?.map((item) =>
            item.id === updated.id
              ? { ...item, enabled: updated.enabled }
              : item,
          ) ?? null,
      );
      await queryClient.invalidateQueries({ queryKey: ['checks'] });
      setMessage(
        updated.enabled
          ? `${updated.label} habilitado para novas análises.`
          : `${updated.label} desabilitado para novas análises.`,
      );
    } catch (error) {
      setCheckSettings(
        (current) =>
          current?.map((item) =>
            item.id === check.id ? { ...item, enabled: check.enabled } : item,
          ) ?? null,
      );
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o plugin.',
      );
    } finally {
      setPendingCheckIds((current) => {
        const next = new Set(current);
        next.delete(check.id);
        return next;
      });
      setBusy(false);
    }
  }

  function getCheckStatus(check: CheckCatalogItem) {
    if (!check.enabled) {
      return { label: 'Desabilitada', tone: 'muted' };
    }
    if (!check.configured) {
      return { label: 'Chave ausente', tone: 'warning' };
    }
    return { label: 'Configurada', tone: 'success' };
  }

  function getCredentialSource(name: string) {
    const credential = credentials?.find((item) => item.name === name);
    if (!credential?.configured) return 'não configurada';
    return credential.source === 'vault' ? 'cofre' : 'ambiente';
  }

  function formatUsd(value: number | undefined) {
    if (value === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatCycleEnd(value: string | undefined) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
  }

  return (
    <section className="panel credentials-panel" id="credentials">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Administração interna</span>
          <h2>Credenciais de integrações</h2>
        </div>
        <span className="lock-badge">Cofre AES-256-GCM</span>
      </div>
      <p className="muted section-copy">
        Acesso interno ao cofre de chaves das integrações. Com o Supabase
        configurado, elas ficam persistentes entre deploys e instâncias da
        Vercel. Os valores já armazenados nunca são exibidos.
      </p>

      <div className="admin-unlock">
        <button
          className="button button--secondary"
          disabled={busy}
          onClick={refresh}
        >
          {busy ? 'Carregando…' : 'Atualizar credenciais'}
        </button>
        {credentials && (
          <button
            className="button button--ghost"
            disabled={busy}
            onClick={() => {
              setCredentials(null);
              setCheckSettings(null);
              setApifyUsage(null);
              setMessage(null);
            }}
            type="button"
          >
            Fechar cofre
          </button>
        )}
      </div>

      {message && (
        <p className="inline-notice" role="status">
          {message}
        </p>
      )}

      {credentials && (
        <div className="credentials-content">
          <form className="credential-form" onSubmit={handleSave}>
            <label>
              Identificador
              <input
                autoCapitalize="characters"
                onChange={(event) => setName(event.target.value.toUpperCase())}
                pattern="[A-Z][A-Z0-9_]{2,63}"
                placeholder="VIRUSTOTAL_API_KEY"
                required
                value={name}
              />
            </label>
            <label>
              Nova chave
              <input
                autoComplete="new-password"
                onChange={(event) => setValue(event.target.value)}
                placeholder="Cole a chave; ela não será exibida novamente"
                required
                type="password"
                value={value}
              />
            </label>
            <button className="button" disabled={busy} type="submit">
              Adicionar ou substituir
            </button>
          </form>

          <div className="credential-list">
            {credentials.length === 0 && (
              <p className="muted">Nenhuma credencial registrada.</p>
            )}
            {credentials.map((credential) => (
              <div className="credential-item" key={credential.name}>
                <div>
                  <strong>{credential.name}</strong>
                  <span>
                    {credential.configured
                      ? `Configurada via ${credential.source === 'vault' ? 'cofre' : 'ambiente'}`
                      : 'Não configurada'}
                  </span>
                </div>
                <button
                  className="button button--danger button--small"
                  disabled={busy || credential.source !== 'vault'}
                  onClick={() => handleRemove(credential.name)}
                  type="button"
                >
                  Remover do cofre
                </button>
              </div>
            ))}
          </div>

          <section className="apify-usage" aria-labelledby="apify-usage-title">
            <div className="apify-usage__heading">
              <div>
                <h3 id="apify-usage-title">Cota Apify</h3>
                <p className="muted">
                  Consumo mensal real e proteção automática contra excedente.
                </p>
              </div>
              <span
                className={`integration-status integration-status--${
                  !apifyUsage
                    ? 'muted'
                    : apifyUsage.guardActive
                      ? 'warning'
                      : 'success'
                }`}
              >
                {!apifyUsage
                  ? 'Aguardando consulta'
                  : apifyUsage.guardActive
                    ? 'Bloqueio preventivo'
                    : 'Proteção ativa'}
              </span>
            </div>

            {!apifyUsage && (
              <p className="muted">
                Atualize as credenciais para consultar a cota do Apify.
              </p>
            )}

            {apifyUsage?.status === 'available' && (
              <>
                <div className="apify-usage__numbers">
                  <span>
                    <strong>{formatUsd(apifyUsage.remainingUsd)}</strong>
                    disponível de {formatUsd(apifyUsage.monthlyCreditUsd)}
                  </span>
                  <span>{Math.round(apifyUsage.usagePercent ?? 0)}% utilizado</span>
                </div>
                <div
                  aria-label={`${Math.round(apifyUsage.usagePercent ?? 0)}% da cota mensal Apify utilizada`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={Math.round(apifyUsage.usagePercent ?? 0)}
                  className={`apify-usage__bar${apifyUsage.guardActive ? ' apify-usage__bar--blocked' : ''}`}
                  role="progressbar"
                >
                  <span
                    style={{ width: `${Math.min(100, apifyUsage.usagePercent ?? 0)}%` }}
                  />
                </div>
                <p className="apify-usage__note">
                  Plano {apifyUsage.planTier ?? 'desconhecido'} · bloqueio a partir de{' '}
                  {apifyUsage.guardThresholdPercent}%
                  {formatCycleEnd(apifyUsage.cycleEndsAt)
                    ? ` · ciclo termina em ${formatCycleEnd(apifyUsage.cycleEndsAt)}`
                    : ''}
                </p>
              </>
            )}

            {apifyUsage && apifyUsage.status !== 'available' && (
              <p className="apify-usage__note apify-usage__note--warning">
                {apifyUsage.guardReason ??
                  'A cota não pôde ser verificada; as ferramentas Apify permanecem bloqueadas.'}
              </p>
            )}

            {apifyUsage?.guardActive && apifyUsage.guardReason && (
              <p className="apify-usage__note apify-usage__note--warning">
                {apifyUsage.guardReason}
              </p>
            )}
          </section>

          <div className="plugin-settings">
            <div className="plugin-settings__heading">
              <div>
                <span className="eyebrow">Gerenciamento de APIs</span>
                <h3>Status das integrações</h3>
              </div>
              <span className="lock-badge">Acesso administrativo</span>
            </div>
            <p className="muted plugin-settings__copy">
              Consulte quais integrações estão configuradas, de onde a
              credencial está sendo lida e habilite ou desabilite cada módulo
              sem editar código. O status abaixo representa configuração local e
              habilitação; ele não envia a chave para o navegador nem faz uma
              chamada externa automática.
            </p>
            <div className="plugin-list">
              {checkSettings?.map((check) => {
                const inputId = `plugin-toggle-${check.id}`;
                return (
                  <div className="plugin-item" key={check.id}>
                    <label className="plugin-item__content" htmlFor={inputId}>
                      <strong>{check.label}</strong>
                      <small>
                        {check.requiredCredentials.length > 0
                          ? check.requiredCredentials.join(', ')
                          : 'Sem credencial externa'}
                      </small>
                      <span className="integration-meta">
                        <span
                          className={`integration-status integration-status--${getCheckStatus(check).tone}`}
                        >
                          {getCheckStatus(check).label}
                        </span>
                        {check.requiredCredentials.length > 0 && (
                          <span>
                            {check.requiredCredentials
                              .map(
                                (credential) =>
                                  `${credential}: ${getCredentialSource(credential)}`,
                              )
                              .join(' · ')}
                          </span>
                        )}
                      </span>
                    </label>
                    <input
                      id={inputId}
                      aria-label={`${check.enabled ? 'Desabilitar' : 'Habilitar'} ${check.label}`}
                      checked={check.enabled}
                      disabled={busy || pendingCheckIds.has(check.id)}
                      onChange={(event) =>
                        void handleToggleCheck(
                          check,
                          event.currentTarget.checked,
                        )
                      }
                      type="checkbox"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
