'use client';

import { Building2, AlertCircle } from 'lucide-react';

export default function CongressPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="text-blue-400" />
              Congressional Tracker
            </h1>
            <p className="text-gray-400 mt-1">
              Track stock trades by members of Congress (disclosed under STOCK Act)
            </p>
          </div>
        </div>

        {/* Coming Soon Overlay */}
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="mb-6">
              <Building2 className="w-24 h-24 text-gray-600 mx-auto" />
            </div>
            <h2 className="text-6xl font-bold text-red-500 mb-4 animate-pulse">
              COMING SOON
            </h2>
            <p className="text-xl text-gray-400 max-w-md mx-auto">
              Congressional trading data feed is being configured.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              We&apos;re integrating a reliable data source for STOCK Act disclosures.
            </p>
            <div className="mt-8 p-4 bg-gray-800/50 rounded-lg max-w-sm mx-auto border border-gray-700">
              <p className="text-xs text-gray-500 mb-2">
                Data sources under evaluation:
              </p>
              <ul className="text-sm text-gray-400 space-y-1 text-left">
                <li className="flex items-center gap-2">
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                  Unusual Whales API
                </li>
                <li className="flex items-center gap-2">
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                  Quiver Quant
                </li>
                <li className="flex items-center gap-2">
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                  Direct SEC/House scraping
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
