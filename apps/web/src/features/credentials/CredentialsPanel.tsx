import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CheckCatalogItem, CredentialStatus } from '@osint-pier/contracts';
import {
  listCheckSettings,
  listCredentials,
  removeCredential,
  saveCredential,
  setCheckEnabled,
} from '../../api/client';

export function CredentialsPanel() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [credentials, setCredentials] = useState<CredentialStatus[] | null>(
    null,
  );
  const [checkSettings, setCheckSettings] = useState<CheckCatalogItem[] | null>(
    null,
  );
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      const [nextCredentials, nextCheckSettings] = await Promise.all([
        listCredentials(token),
        listCheckSettings(token),
      ]);
      setCredentials(nextCredentials);
      setCheckSettings(nextCheckSettings);
    } catch (error) {
      setCredentials(null);
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
      await saveCredential(token, name.trim().toUpperCase(), value);
      setName('');
      setValue('');
      setCredentials(await listCredentials(token));
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
      await removeCredential(token, credentialName);
      setCredentials(await listCredentials(token));
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

  async function handleToggleCheck(check: CheckCatalogItem) {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await setCheckEnabled(token, check.id, !check.enabled);
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
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o plugin.',
      );
    } finally {
      setBusy(false);
    }
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
        Isto não cria login de usuário: é apenas o acesso administrativo ao
        cofre de chaves das integrações. O token fica somente na memória desta
        página e valores já armazenados nunca são exibidos.
      </p>

      <div className="admin-unlock">
        <label>
          Token administrativo
          <input
            autoComplete="current-password"
            onChange={(event) => setToken(event.target.value)}
            placeholder="ADMIN_TOKEN"
            type="password"
            value={token}
          />
        </label>
        <button
          className="button button--secondary"
          disabled={!token || busy}
          onClick={refresh}
        >
          {busy ? 'Verificando…' : 'Abrir cofre'}
        </button>
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

          <div className="plugin-settings">
            <div className="plugin-settings__heading">
              <div>
                <span className="eyebrow">Execução</span>
                <h3>Plugins habilitados</h3>
              </div>
              <span className="muted">Sem editar código</span>
            </div>
            <p className="muted plugin-settings__copy">
              Desabilitar um módulo remove-o das próximas análises. A alteração
              fica salva no arquivo local de configuração.
            </p>
            <div className="plugin-list">
              {checkSettings?.map((check) => (
                <label className="plugin-item" key={check.id}>
                  <span>
                    <strong>{check.label}</strong>
                    <small>
                      {check.requiredCredentials.length > 0
                        ? check.requiredCredentials.join(', ')
                        : 'Sem credencial externa'}
                    </small>
                  </span>
                  <input
                    aria-label={`${check.enabled ? 'Desabilitar' : 'Habilitar'} ${check.label}`}
                    checked={check.enabled}
                    disabled={busy}
                    onChange={() => void handleToggleCheck(check)}
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
