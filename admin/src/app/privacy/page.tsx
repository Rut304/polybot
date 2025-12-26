'use client';

import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
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
            <div className="p-3 bg-neon-green/20 rounded-lg">
              <Shield className="w-8 h-8 text-neon-green" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Privacy Policy</h1>
              <p className="text-gray-400">Last Updated: January 2025</p>
            </div>
          </div>

          {/* Intro */}
          <div className="bg-neon-green/10 border border-neon-green/30 rounded-lg p-4 mb-8">
            <p className="text-gray-300 leading-relaxed">
              Welcome to PolyBot, a service provided by RutRoh LLC. This Privacy Policy explains how we 
              collect, use, and share information about you when you use our website and related services. 
              We are committed to protecting your privacy and ensuring the security of your personal information. 
              This Privacy Policy is designed to comply with the General Data Protection Regulation (GDPR) and 
              the California Consumer Privacy Act (CCPA).
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">1. Information We Collect</h2>
              
              <h3 className="text-lg font-medium text-neon-purple mt-4 mb-2">Information You Provide Directly</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong>Email Address:</strong> We collect your email address when you register for an account or subscribe to our newsletter.</li>
                <li><strong>Wallet Addresses:</strong> We collect wallet addresses you connect from the PolyMarket platform to enable trading and tracking.</li>
                <li><strong>API Keys:</strong> You may provide encrypted API keys for connected trading platforms.</li>
                <li><strong>Communications:</strong> We collect information contained in any communications you send to us.</li>
              </ul>

              <h3 className="text-lg font-medium text-neon-purple mt-4 mb-2">Information Collected Automatically</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong>IP Address:</strong> We automatically collect your IP address when you access our Platform.</li>
                <li><strong>Usage Data:</strong> We collect information about how you use our Platform, including pages visited, features used, and time spent.</li>
                <li><strong>Device Information:</strong> We may collect information about the device you use to access our Platform.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">2. How We Use Your Information</h2>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong>Providing the Service:</strong> To provide you with access to and use of the PolyBot Platform</li>
                <li><strong>Communication:</strong> To communicate with you, including responding to your inquiries and providing customer support</li>
                <li><strong>Analytics:</strong> To analyze how users interact with our Platform and improve the user experience</li>
                <li><strong>Platform Improvement:</strong> To improve and optimize our Platform and develop new features</li>
                <li><strong>Security:</strong> To protect the security and integrity of our Platform and prevent fraud</li>
                <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes</li>
                <li><strong>Marketing:</strong> With your consent, we may use your email address to send you newsletters and promotional materials</li>
              </ul>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-4">
                <p className="text-blue-200">
                  <strong>Important Note:</strong> We do NOT custody funds or directly process payments. 
                  Our platform facilitates trading automation, but all financial transactions occur directly 
                  on the PolyMarket platform itself.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">3. Information Sharing and Disclosure</h2>
              <p className="text-gray-300 mb-3">We may share your information with the following categories of recipients:</p>
              
              <h3 className="text-lg font-medium text-neon-purple mt-4 mb-2">Service Providers</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong>Supabase:</strong> For database services</li>
                <li><strong>Stripe:</strong> For payment processing (subscription billing)</li>
                <li><strong>AWS (Amazon Web Services):</strong> For hosting our Platform</li>
                <li><strong>Vercel:</strong> For frontend hosting and deployment</li>
                <li><strong>Privy:</strong> For authentication services</li>
              </ul>

              <h3 className="text-lg font-medium text-neon-purple mt-4 mb-2">Legal Authorities</h3>
              <p className="text-gray-300">
                We may disclose your information to law enforcement, government agencies, or other legal authorities 
                if required to do so by law or legal process.
              </p>

              <div className="bg-neon-green/10 border border-neon-green/30 rounded-lg p-4 mt-4">
                <p className="text-neon-green font-semibold">
                  We will NOT sell or rent your personal information to third parties for their marketing purposes.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">4. Data Retention</h2>
              <p className="text-gray-300 leading-relaxed">
                We will retain your personal information for as long as necessary to fulfill the purposes outlined 
                in this Privacy Policy, unless a longer retention period is required or permitted by law.
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mt-3">
                <li><strong>Account Information:</strong> Retained as long as your account is active. You can close your account to initiate deletion.</li>
                <li><strong>Usage Data:</strong> Retained for a limited period to analyze trends and improve our Platform.</li>
                <li><strong>Cookies and Tracking Data:</strong> Retention periods vary depending on the specific cookie or tracking technology.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">5. Your Privacy Rights</h2>
              <p className="text-gray-300 mb-3">You have the following rights regarding your personal information:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong>Right to Access:</strong> You have the right to request access to the personal information we hold about you.</li>
                <li><strong>Right to Rectification:</strong> You have the right to request that we correct any inaccurate or incomplete personal information.</li>
                <li><strong>Right to Erasure:</strong> You have the right to request that we delete your personal information, subject to certain exceptions.</li>
                <li><strong>Right to Restriction of Processing:</strong> You have the right to request that we restrict the processing of your personal information.</li>
                <li><strong>Right to Data Portability:</strong> You have the right to receive your personal information in a structured, commonly used format.</li>
                <li><strong>Right to Object:</strong> You have the right to object to the processing of your personal information for certain purposes.</li>
                <li><strong>Right to Opt-Out of Sale (CCPA):</strong> As we do not sell your personal information, this right is not applicable.</li>
                <li><strong>Right to Non-Discrimination (CCPA):</strong> We will not discriminate against you for exercising your privacy rights.</li>
              </ul>
              <p className="text-gray-300 mt-3">
                To exercise these rights, please contact us at <span className="text-neon-purple">privacy@polybot.io</span>. 
                We will respond to your request within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">6. Cookies and Tracking</h2>
              <p className="text-gray-300 mb-3">
                We use cookies and similar tracking technologies to collect information about your browsing activity:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong>Essential Cookies:</strong> Necessary for the operation of our Platform</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our Platform</li>
                <li><strong>Functional Cookies:</strong> Enable us to remember your preferences</li>
              </ul>
              <p className="text-gray-300 mt-3">
                You can control cookies through your browser settings. Blocking cookies may affect Platform functionality.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">7. Security</h2>
              <p className="text-gray-300 mb-3">
                We take reasonable measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong>Encryption:</strong> Industry-standard encryption for data in transit</li>
                <li><strong>Access Controls:</strong> Restricted access to authorized personnel only</li>
                <li><strong>Regular Security Assessments:</strong> Ongoing vulnerability identification and remediation</li>
                <li><strong>Data Center Security:</strong> Secure data centers with physical and logical security measures</li>
              </ul>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                <p className="text-yellow-200">
                  No method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">8. International Users</h2>
              <p className="text-gray-300 leading-relaxed">
                PolyBot is operated from the United States. If you are accessing the Platform from outside the 
                United States, your information may be transferred to, stored, and processed in the United States. 
                By using our Platform, you consent to this transfer, storage, and processing. We ensure appropriate 
                safeguards are in place to protect your personal information in accordance with applicable laws, 
                including GDPR and CCPA.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">9. Children&apos;s Privacy</h2>
              <p className="text-gray-300 leading-relaxed">
                Our Platform is not intended for children under the age of 18. We do not knowingly collect personal 
                information from children under 18. If you are a parent or guardian and believe that your child has 
                provided us with personal information, please contact us. We will take steps to delete the information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">10. Changes to This Policy</h2>
              <p className="text-gray-300 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by 
                posting the new Privacy Policy on our Platform and updating the &quot;Last Updated&quot; date. Your continued 
                use of our Platform after the effective date constitutes your acceptance of the changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neon-blue mb-4">11. Contact Us</h2>
              <p className="text-gray-300">
                If you have any questions or concerns about this Privacy Policy, please contact us:
              </p>
              <div className="bg-dark-card border border-dark-border rounded-lg p-4 mt-3">
                <p className="text-white font-semibold">RutRoh LLC</p>
                <p className="text-gray-400">Email: privacy@polybot.io</p>
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
