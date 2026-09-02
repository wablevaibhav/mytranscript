/**
 * PrivacyBadge Component
 * Details the zero-cloud, client-only privacy guarantee at the bottom of the popup.
 */

import React from 'react';
import { Lock } from 'lucide-react';

export const PrivacyBadge: React.FC = () => {
  return (
    <footer className="px-4 py-2.5 bg-surface/50 border-t border-subtle/30 text-center">
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <Lock className="w-3 h-3 text-emerald-400" />
        <span>Privacy-First • Zero Cloud Uploads • Local Device Only</span>
      </div>
    </footer>
  );
};
