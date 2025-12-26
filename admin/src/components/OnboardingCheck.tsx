'use client';

import { useState, useEffect } from 'react';
import { useTier } from '@/lib/useTier';
import { OnboardingWizard } from '@/components/OnboardingWizard';

/**
 * Component that checks if user has completed onboarding
 * Shows the wizard modal for new users
 */
export function OnboardingCheck({ children }: { children: React.ReactNode }) {
  const { profile, isLoading, refreshProfile } = useTier();
  const [showWizard, setShowWizard] = useState(false);
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);

  useEffect(() => {
    // Wait for profile to load
    if (isLoading || checkedOnboarding) return;

    // Check if onboarding is needed
    if (profile && !profile.onboardingCompleted) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setShowWizard(true);
      }, 500);
      return () => clearTimeout(timer);
    }
    
    setCheckedOnboarding(true);
  }, [profile, isLoading, checkedOnboarding]);

  const handleComplete = () => {
    setShowWizard(false);
    setCheckedOnboarding(true);
    refreshProfile();
  };

  const handleSkip = () => {
    setShowWizard(false);
    setCheckedOnboarding(true);
    // Store in localStorage that user skipped (so we don't show again this session)
    localStorage.setItem('polybot_onboarding_skipped', 'true');
  };

  return (
    <>
      {children}
      {showWizard && (
        <OnboardingWizard
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      )}
    </>
  );
}
