'use client';

import { motion } from 'framer-motion';
import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Back Button */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-neon-purple/20 rounded-lg">
              <FileText className="w-8 h-8 text-neon-purple" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Terms of Service</h1>
              <p className="text-gray-400">Last Updated: January 2025</p>
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                Welcome to PolyBot! These Terms of Service (&quot;Terms&quot;) govern your access to and use of the PolyBot 
                web platform (the &quot;Platform&quot;), owned and operated by RutRoh LLC (&quot;RutRoh,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). 
                By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree to 
                these Terms, you may not access or use the Platform. These Terms constitute a legally binding 
                agreement between you and RutRoh LLC.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">2. Description of Service</h2>
              <p className="text-gray-300 leading-relaxed">
                PolyBot is a web platform designed to facilitate automated trading strategies on PolyMarket 
                prediction markets. We provide software tools, analytics, and automation to assist users in 
                building and managing trading strategies.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                <p className="text-yellow-200 font-semibold">IMPORTANT:</p>
                <ul className="list-disc list-inside text-yellow-100 mt-2 space-y-1">
                  <li>PolyBot is a FACILITATOR, not an OPERATOR of prediction markets</li>
                  <li>We do not operate or control the PolyMarket platform</li>
                  <li>We are not affiliated with PolyMarket</li>
                  <li>We do NOT custody user funds, execute trades directly, or hold user money</li>
                  <li>All trading activity and financial transactions occur directly on the PolyMarket platform</li>
                  <li>We provide informational and entertainment tools only</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">3. User Eligibility</h2>
              <p className="text-gray-300 leading-relaxed">
                You must be at least eighteen (18) years of age to access and use the Platform. By using the 
                Platform, you represent and warrant that you are at least 18 years old. The Platform is not 
                available to individuals residing in New York or Washington state. Accessing or using the 
                Platform from these jurisdictions is strictly prohibited. We reserve the right to request 
                proof of age and residency.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">4. Account Registration</h2>
              <p className="text-gray-300 leading-relaxed">
                While you may be able to access certain features of the Platform without registering, some 
                features may require you to create an account. You are responsible for maintaining the 
                confidentiality of your account credentials and for all activities that occur under your account. 
                You agree to provide accurate, current, and complete information during the registration process 
                and to update such information to keep it accurate, current, and complete.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">5. Prohibited Activities</h2>
              <p className="text-gray-300 mb-3">You agree not to engage in any of the following prohibited activities:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Violating any applicable law, regulation, or ordinance</li>
                <li>Using the Platform for any illegal or unauthorized purpose</li>
                <li>Attempting to gain unauthorized access to the Platform or any related systems</li>
                <li>Interfering with or disrupting the operation of the Platform</li>
                <li>Using automated means to access the Platform without permission</li>
                <li>Engaging in activity that could damage, disable, or impair the Platform</li>
                <li>Impersonating any person or entity</li>
                <li>Distributing spam or unsolicited communications</li>
                <li>Collecting personally identifiable information from other users</li>
                <li>Reverse engineering, decompiling, or disassembling any aspect of the Platform</li>
                <li>Engaging in activity that could be construed as illegal gambling</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">6. Intellectual Property Rights</h2>
              <p className="text-gray-300 leading-relaxed">
                The Platform, including all content, features, and functionality are owned by RutRoh LLC, its 
                licensors, or other providers of such material and are protected by United States and 
                international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
              <p className="text-gray-300 leading-relaxed mt-3">
                You are granted a limited, non-exclusive, non-transferable, revocable license to access and 
                use the Platform for your personal, non-commercial use only.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">7. Disclaimers</h2>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-200 uppercase font-semibold mb-3">
                  THE PLATFORM IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT ANY WARRANTIES 
                  OF ANY KIND, EITHER EXPRESS OR IMPLIED.
                </p>
                <ul className="list-disc list-inside text-red-100 space-y-2">
                  <li><strong>FACILITATOR ROLE:</strong> We are solely a facilitator providing tools and analytics</li>
                  <li><strong>ENTERTAINMENT PURPOSES:</strong> The Platform is intended for entertainment and informational purposes only</li>
                  <li><strong>NO FINANCIAL ADVICE:</strong> We do not provide any financial, investment, or legal advice</li>
                  <li><strong>NO GUARANTEES:</strong> There are no guarantees of financial gain from using PolyBot</li>
                  <li><strong>RISK WARNING:</strong> Prediction markets are inherently risky, and you may lose money</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">8. Limitation of Liability</h2>
              <p className="text-gray-300 leading-relaxed">
                TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL RUTROH LLC BE LIABLE FOR 
                ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT 
                LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
              <p className="text-gray-300 leading-relaxed mt-3">
                OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR RELATING TO THESE TERMS OR THE 
                PLATFORM SHALL NOT EXCEED THE AMOUNT YOU PAID TO US, IF ANY, IN THE TWELVE (12) MONTHS PRIOR 
                TO THE EVENT GIVING RISE TO THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">9. Indemnification</h2>
              <p className="text-gray-300 leading-relaxed">
                You agree to indemnify, defend, and hold harmless RutRoh LLC, its affiliates, and their 
                respective officers, directors, employees, agents, suppliers, and licensors from and against 
                any and all claims, liabilities, damages, losses, costs, expenses, or fees arising out of or 
                relating to your access to or use of the Platform, your violation of these Terms, or your 
                violation of any rights of another party.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">10. Termination</h2>
              <p className="text-gray-300 leading-relaxed">
                We reserve the right to terminate your access to the Platform at any time, with or without cause, 
                and with or without notice. You may terminate your account at any time by ceasing all use of the 
                Platform. Upon termination, all rights granted to you under these Terms will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">11. Governing Law</h2>
              <p className="text-gray-300 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the State of 
                Delaware, without regard to its conflict of laws principles.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">12. Dispute Resolution</h2>
              <p className="text-gray-300 leading-relaxed">
                Any dispute arising out of or relating to these Terms or the Platform shall be resolved through 
                binding arbitration administered by the American Arbitration Association (AAA) in accordance 
                with its Commercial Arbitration Rules. The arbitration shall be conducted in Wilmington, Delaware.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">13. Changes to Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will post any changes to these Terms 
                on the Platform and will indicate the date of the last update. Your continued use of the Platform 
                after any such changes constitutes your acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">14. Privacy Policy</h2>
              <p className="text-gray-300 leading-relaxed">
                Your privacy is important to us. Please review our{' '}
                <Link href="/privacy" className="text-neon-purple hover:underline">
                  Privacy Policy
                </Link>
                , which is incorporated into these Terms by reference, to understand our practices regarding 
                the collection, use, and disclosure of your personal information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">15. Contact Information</h2>
              <p className="text-gray-300 leading-relaxed">
                If you have any questions about these Terms or the Platform, please contact us at:
              </p>
              <div className="bg-dark-card border border-dark-border rounded-lg p-4 mt-3">
                <p className="text-white font-semibold">RutRoh LLC</p>
                <p className="text-gray-400">Email: legal@polybot.io</p>
              </div>
            </section>

            <div className="border-t border-dark-border pt-6 mt-8">
              <p className="text-gray-500 text-sm text-center">
                © 2025-2026 RutRoh LLC. All Rights Reserved.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
