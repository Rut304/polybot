import { Header } from '@/components/Header';
import PricingTable from '@/components/PricingTable';

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
          {/* Reuse dashboard header logic or simplified nav if not logged in */}
          <div className="p-6">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-4xl text-center">
                    <h2 className="text-base font-semibold leading-7 text-indigo-600">Pricing</h2>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                        Pricing plans for every stage of your trading journey
                    </p>
                </div>
                <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600">
                    From paper trading to institutional volume, PolyBot scales with you.
                </p>
                <div className="mt-16 flow-root pb-24">
                    <PricingTable />
                </div>
            </div>
          </div>
        </div>
    );
}
