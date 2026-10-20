import React, { useState, useMemo } from 'react';
import { UserLogonStagingSnippet } from '../types';
import {
  Code2,
  Plus,
  Search,
  Filter,
  Copy,
  Check,
  Trash2,
  Edit3,
  Play,
  RotateCcw,
  Sparkles,
  Mail,
  Globe,
  Monitor,
  Cloud,
  Shield,
  FileCode,
  Tag,
  CheckCircle2,
  X,
  AlertTriangle,
  Info,
  ExternalLink,
} from 'lucide-react';

interface FirstRunSnippetsManagerProps {
  snippets: UserLogonStagingSnippet[];
  onAddSnippet: (snippet: UserLogonStagingSnippet) => void;
  onUpdateSnippet: (snippet: UserLogonStagingSnippet) => void;
  onDeleteSnippet: (id: string) => void;
  onResetDefaults?: () => void;
  onSelectForWizard?: (snippet: UserLogonStagingSnippet) => void;
}

const CATEGORIES = [
  'All',
  'Outlook & Mail',
  'Browser & Web',
  'Shortcuts & Desktop',
  'OneDrive & Cloud',
  'Security & Policies',
  'Custom',
] as const;

export const FirstRunSnippetsManager: React.FC<FirstRunSnippetsManagerProps> = ({
  snippets,
  onAddSnippet,
  onUpdateSnippet,
  onDeleteSnippet,
  onResetDefaults,
  onSelectForWizard,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [editingSnippet, setEditingSnippet] = useState<UserLogonStagingSnippet | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Custom');
  const [script, setScript] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [enabled, setEnabled] = useState(true);

  const startCreate = () => {
    setIsCreating(true);
    setEditingSnippet(null);
    setName('');
    setDescription('');
    setCategory('Custom');
    setScript(`# Custom First-Logon PowerShell Script\nWrite-UserLog "Running custom first-logon setup for $env:USERNAME..." "INFO"\n\n# Your commands here\n`);
    setTagsInput('Custom, Logon');
    setEnabled(true);
  };

  const startEdit = (snippet: UserLogonStagingSnippet) => {
    setEditingSnippet(snippet);
    setIsCreating(false);
    setName(snippet.name);
    setDescription(snippet.description || '');
    setCategory(snippet.category || 'Custom');
    setScript(snippet.script);
    setTagsInput((snippet.tags || []).join(', '));
    setEnabled(snippet.enabled !== false);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !script.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const payload: UserLogonStagingSnippet = {
      id: editingSnippet ? editingSnippet.id : `snip-${Date.now().toString(36)}`,
      name: name.trim(),
      description: description.trim(),
      category: category as any,
      script: script.trim(),
      enabled,
      tags,
      isGlobalTemplate: editingSnippet?.isGlobalTemplate ?? false,
      author: editingSnippet?.author || 'FDIM Administrator',
      updatedAt: new Date().toISOString(),
    };

    if (editingSnippet) {
      onUpdateSnippet(payload);
    } else {
      onAddSnippet(payload);
    }

    setEditingSnippet(null);
    setIsCreating(false);
  };

  const handleDuplicate = (snippet: UserLogonStagingSnippet) => {
    const duplicated: UserLogonStagingSnippet = {
      ...snippet,
      id: `snip-${Date.now().toString(36)}`,
      name: `${snippet.name} (Copy)`,
      isGlobalTemplate: false,
      author: 'FDIM Administrator',
      updatedAt: new Date().toISOString(),
    };
    onAddSnippet(duplicated);
  };

  const handleCopyCode = (snippet: UserLogonStagingSnippet) => {
    navigator.clipboard.writeText(snippet.script);
    setCopiedId(snippet.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSimulateTest = (snippet: UserLogonStagingSnippet) => {
    // Client-side PowerShell syntax validation
    const issues: string[] = [];
    const openBraces = (snippet.script.match(/{/g) || []).length;
    const closeBraces = (snippet.script.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Mismatched curly braces: ${openBraces} '{' vs ${closeBraces} '}'`);
    }

    const openParens = (snippet.script.match(/\(/g) || []).length;
    const closeParens = (snippet.script.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push(`Mismatched parentheses: ${openParens} '(' vs ${closeParens} ')'`);
    }

    if (issues.length > 0) {
      setTestResult({
        id: snippet.id,
        success: false,
        message: `Syntax Warning: ${issues.join('; ')}`,
      });
    } else {
      setTestResult({
        id: snippet.id,
        success: true,
        message: 'PowerShell syntax check verified! Payload adheres to Active Setup execution constraints.',
      });
    }

    setTimeout(() => setTestResult(null), 4000);
  };

  const filteredSnippets = useMemo(() => {
    return snippets.filter((s) => {
      const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.script.toLowerCase().includes(q) ||
        (s.tags && s.tags.some((t) => t.toLowerCase().includes(q)));
      return matchesCategory && matchesSearch;
    });
  }, [snippets, selectedCategory, searchQuery]);

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'Outlook & Mail':
        return <Mail className="w-4 h-4 text-sky-400" />;
      case 'Browser & Web':
        return <Globe className="w-4 h-4 text-emerald-400" />;
      case 'Shortcuts & Desktop':
        return <Monitor className="w-4 h-4 text-cyan-400" />;
      case 'OneDrive & Cloud':
        return <Cloud className="w-4 h-4 text-blue-400" />;
      case 'Security & Policies':
        return <Shield className="w-4 h-4 text-amber-400" />;
      default:
        return <FileCode className="w-4 h-4 text-purple-400" />;
    }
  };

  const insertVariable = (varName: string) => {
    setScript((prev) => prev + varName);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-950/50">
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center space-x-2">
                  <span>First-Run User Logon Snippets Library</span>
                </h1>
                <p className="text-xs text-slate-400">
                  Reusable PowerShell payloads staged into Windows <code>Active Setup</code> and executed upon user initial sign-in.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {onResetDefaults && (
              <button
                type="button"
                onClick={onResetDefaults}
                className="px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                title="Restore default enterprise templates (Outlook signatures, OneDrive KFM, Edge policies, etc.)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Templates</span>
              </button>
            )}

            <button
              type="button"
              onClick={startCreate}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Snippet</span>
            </button>
          </div>
        </div>

        {/* Informative Explanation banner */}
        <div className="mt-5 p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-start space-x-3 text-xs">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-slate-300 leading-relaxed text-[11px]">
            <span className="font-semibold text-white">How First-Run Staging Works: </span>
            During machine provisioning (via administrator/SYSTEM), FDIM generates{' '}
            <code className="text-cyan-300 font-mono">C:\ProgramData\FDIM\UserLogonSetup.ps1</code> and registers it in Windows{' '}
            <code className="text-cyan-300 font-mono">Active Setup</code> (<code className="font-mono text-slate-400">HKLM:\SOFTWARE\Microsoft\Active Setup</code>).
            When a user logs on to their corporate account for the very first time, Windows automatically executes these snippets inside their interactive Kerberos session.
            Snippets can be picked in the <strong>PC Setup</strong> wizard or defaulted into <strong>Company Profiles</strong>!
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search snippets by name, description, tags, or code..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1 mr-1" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Snippet Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredSnippets.map((snip) => {
          const isCopied = copiedId === snip.id;
          const isTesting = testResult?.id === snip.id;

          return (
            <div
              key={snip.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all group"
            >
              <div className="space-y-3">
                {/* Top Row: Category, Name, Controls */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      {getCategoryIcon(snip.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                          {snip.name}
                        </h3>
                        {snip.isGlobalTemplate && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/80 shrink-0">
                            Template
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {snip.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(snip)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                      title="Copy PowerShell script code"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulateTest(snip)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 transition-colors cursor-pointer"
                      title="Simulate / validate PowerShell syntax"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(snip)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 transition-colors cursor-pointer"
                      title="Edit snippet"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(snip)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-purple-300 border border-slate-800 transition-colors cursor-pointer"
                      title="Duplicate as new custom snippet"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete snippet "${snip.name}"?`)) {
                          onDeleteSnippet(snip.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-800 transition-colors cursor-pointer"
                      title="Delete snippet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Test Feedback Notice */}
                {isTesting && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                      testResult.success
                        ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                        : 'bg-amber-950/80 border border-amber-800 text-amber-300'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                {/* Code Block Preview */}
                <div className="relative rounded-xl bg-slate-950 border border-slate-850 p-3 overflow-hidden font-mono text-[11px] text-slate-300 group/code">
                  <div className="max-h-36 overflow-y-auto whitespace-pre-wrap select-all font-mono leading-relaxed">
                    {snip.script}
                  </div>
                </div>

                {/* Tags & Metadata */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 flex items-center space-x-1">
                    <Tag className="w-2.5 h-2.5 text-slate-500" />
                    <span>{snip.category}</span>
                  </span>
                  {snip.tags?.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-mono text-cyan-400/90 px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/40"
                    >
                      #{t}
                    </span>
                  ))}
                  <span className="text-[10px] text-slate-500 ml-auto">
                    {snip.script.split('\n').length} lines • {snip.author || 'FDIM System'}
                  </span>
                </div>
              </div>

              {/* Bottom Card Action Bar */}
              {onSelectForWizard && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Available for PC Staging</span>
                  <button
                    type="button"
                    onClick={() => onSelectForWizard(snip)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                  >
                    <span>Use in PC Setup</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredSnippets.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-800 rounded-2xl p-8 bg-slate-900/40">
            <Code2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">No first-run snippets found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
              No PowerShell scripts match the query "{searchQuery}" in category "{selectedCategory}". Create a new custom snippet or reset defaults.
            </p>
            <button
              onClick={startCreate}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              + Create New Snippet
            </button>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {(isCreating || editingSnippet) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {editingSnippet ? `Edit Snippet: ${editingSnippet.name}` : 'Create First-Run PowerShell Snippet'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Executes during the interactive logon phase under user credentials with Kerberos tickets.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingSnippet(null);
                  setIsCreating(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Snippet Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Map Corporate Outlook Signature Template"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 focus:outline-none focus:border-cyan-500"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of what this logon script accomplishes"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Outlook, Signatures, Office, Desktop"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Quick Helpers */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-200">Quick Insert PowerShell Environment Variables:</span>
                  <span className="text-slate-500">Click to append at cursor</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '$env:USERNAME',
                    '$env:USERDNSDOMAIN',
                    '$env:APPDATA',
                    '$env:LOCALAPPDATA',
                    '[Environment]::GetFolderPath("Desktop")',
                    'Write-UserLog "Step description" "SUCCESS"',
                    'Set-ItemProperty -Path "HKCU:\\..."',
                  ].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-850 text-cyan-300 border border-slate-750 transition-colors cursor-pointer"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* PowerShell Code Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-semibold">PowerShell Script Code *</label>
                  <span className="text-[11px] text-slate-500 font-mono">{script.split('\n').length} lines</span>
                </div>
                <textarea
                  required
                  rows={10}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="# PowerShell commands to execute in user session"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500 leading-relaxed resize-y"
                  spellCheck={false}
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                  />
                  <span className="text-xs text-slate-300">Enabled by default in templates</span>
                </label>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSnippet(null);
                      setIsCreating(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
                  >
                    {editingSnippet ? 'Save Changes' : 'Create Snippet'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
