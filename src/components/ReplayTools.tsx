import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

interface ReplayMeta {
  hash: string;
  deterministic: boolean;
  turnCount: number;
}

export function ReplayTools() {
  const getReplayExport = useGameStore((state) => state.getReplayExport);
  const importReplay = useGameStore((state) => state.importReplay);
  const getBugReportSnippet = useGameStore((state) => state.getBugReportSnippet);
  const pendingDecisionCount = useGameStore((state) => state.pendingDecisions.length);

  const [isOpen, setIsOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const [snippetText, setSnippetText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [meta, setMeta] = useState<ReplayMeta | null>(null);

  function refreshReplayData() {
    const exported = getReplayExport();
    setExportText(exported.json);
    setSnippetText(getBugReportSnippet());
    setMeta({
      hash: exported.hash,
      deterministic: exported.deterministic,
      turnCount: exported.turnCount,
    });
  }

  function openModal() {
    refreshReplayData();
    setImportText('');
    setStatusMessage('');
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage(`${label} copied to clipboard.`);
    } catch {
      setStatusMessage(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  function handleImportReplay() {
    const result = importReplay(importText);
    setStatusMessage(result.message);
    if (result.ok) {
      refreshReplayData();
      setImportText('');
    }
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={openModal} title="Export/import replay and bug snippet">
        Replay Tools
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card replay-modal-card" onClick={(event) => event.stopPropagation()}>
            <h2>Replay Tools</h2>
            {meta && (
              <p className={`replay-meta ${meta.deterministic ? 'text-safe' : 'text-danger'}`}>
                Determinism {meta.deterministic ? 'OK' : 'FAIL'} | Hash {meta.hash} | Turns {meta.turnCount}
              </p>
            )}
            {pendingDecisionCount > 0 && (
              <p className="replay-note">
                Queued decisions are exported only after you click End Turn.
              </p>
            )}

            <div className="replay-section">
              <h3>Export Replay</h3>
              <textarea className="replay-textarea" value={exportText} readOnly />
              <button className="btn btn-secondary" onClick={() => copyText(exportText, 'Replay JSON')}>
                Copy Replay JSON
              </button>
            </div>

            <div className="replay-section">
              <h3>Import Replay</h3>
              <textarea
                className="replay-textarea"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder="Paste replay JSON here"
              />
              <button
                className="btn btn-primary"
                onClick={handleImportReplay}
                disabled={importText.trim().length === 0}
              >
                Import Replay
              </button>
            </div>

            <div className="replay-section">
              <h3>Bug Report Snippet</h3>
              <textarea className="replay-textarea replay-snippet" value={snippetText} readOnly />
              <button className="btn btn-secondary" onClick={() => copyText(snippetText, 'Bug report snippet')}>
                Copy Snippet
              </button>
            </div>

            {statusMessage && <p className="replay-status">{statusMessage}</p>}

            <button className="btn btn-primary replay-close-btn" onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
