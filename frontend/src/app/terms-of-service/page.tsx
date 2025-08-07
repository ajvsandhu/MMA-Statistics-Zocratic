/**
 * Zocratic MMA – Terms of Service
 * © {PLACEHOLDER LEGAL ENTITY}. All rights reserved.
 * 
 */

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-thin mb-6">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">Last updated: 06 August 2025</p>

      {/* -------------------------------------------------- */}
      {/* 0. DEFINITIONS                                    */}
      {/* -------------------------------------------------- */}
      <section className="space-y-4 text-sm leading-relaxed">
        <h2 className="text-xl font-semibold mb-2">0. Definitions</h2>
        <p className="mb-2">
          For ease of reference, although not necessarily for ease of reading, the
          following capitalised terms (used singularly or plurally) shall have the
          meanings ascribed to them below, irrespective of grammatical inflection:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>“<u>Agreement</u>”</strong> means collectively these Terms of
            Service <em>and</em> any documents, policies, schedules,
            exhibits, annexes or amendments expressly incorporated herein by
            reference.
          </li>
          <li>
            <strong>“<u>Operator</u>” / “<u>we</u>” / “<u>us</u>” / “<u>our</u>”</strong>{' '}
            means {`{PLACEHOLDER LEGAL ENTITY}`}, a company duly formed and existing
            under the laws of Ontario, Canada, having its principal place of
            business at {`{PLACEHOLDER FULL MAILING ADDRESS}`}.
          </li>
          <li>
            <strong>“<u>Service</u>”</strong> means the proprietary digital platform
            presently branded “Zocratic MMA”, inclusive of (i) the public website
            located at&nbsp;
            <a
              href="https://www.zocraticmma.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              https://www.zocraticmma.com
            </a>
            , (ii) all sub-domains, successor URLs, mobile or desktop
            applications, APIs, widgets, scripts and related media, and (iii) any
            content, functionality, algorithmic outputs, data visualisations,
            predictive models, or other resources that we make available
            thereon, as the same may evolve from time to time.
          </li>
          <li>
            <strong>“<u>User</u>” / “<u>you</u>” / “<u>your</u>”</strong> means the
            individual or legal entity that accesses, browses, registers for,
            or otherwise utilises any portion of the Service.
          </li>
          <li>
            <strong>“<u>Content</u>”</strong> means, collectively, all text, images,
            graphics, audio, video, data, software, code snippets, statistical
            models, chat transcripts, and other works of authorship that
            (i)&nbsp;originate with the Operator or its licensors (<em>“Operator
            Content”</em>) or (ii)&nbsp;are submitted, uploaded, transmitted,
            generated or otherwise provided by a User (<em>“User Content”</em>).
          </li>
          {/* add more definitions as needed */}
        </ul>
      </section>

      {/* -------------------------------------------------- */}
      {/* 1. ACCEPTANCE                                     */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">1. Acceptance of Agreement</h2>
        <p>
          1.1&nbsp;&nbsp;<strong>Binding Effect.</strong> By (a)&nbsp;clicking the
          button conspicuously labelled “Create Account” (or any similar call-to-action),
          (b)&nbsp;checking a box or taking another affirmative action indicating
          acceptance, or (c)&nbsp;otherwise accessing or using any portion of the
          Service, <u>you irrevocably acknowledge that you have read, understood,
          and agree to be bound by the entirety of this Agreement</u>, without
          limitation or qualification.
        </p>
        <p>
          1.2&nbsp;&nbsp;<strong>Updates.</strong> We may, in our sole but
          commercially reasonable discretion, modify, supplement or replace this
          Agreement (“<u>Update</u>”). Any Update shall become effective on the
          date we designate (“<u>Effective Date</u>”). <em>Material</em> Updates
          will be presented via (i)&nbsp;in-product banner, (ii)&nbsp;electronic
          mail to your registered address, or (iii)&nbsp;other conspicuous means.
          Your continued use of the Service after an Effective Date constitutes
          conclusive acceptance of the Update. Where required by applicable law,
          we will obtain renewed, affirmative assent and record the associated
          version identifier (<code>tos_version</code>) and time stamp
          (<code>tos_accepted_at</code>) in your account metadata.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 2. DESCRIPTION OF SERVICE                         */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">
          2. Description, Evolution and Availability of the Service
        </h2>
        <p>
          2.1&nbsp;&nbsp;<strong>Scope.</strong> The Service offers a
          multi-faceted suite of mixed-martial-arts (“<u>MMA</u>”) analytical
          utilities, including, inter alia: (i)&nbsp;fighter-comparison dashboards;
          (ii)&nbsp;event calendars and historical bout data; (iii)&nbsp;AI-assisted
          predictive outputs; (iv)&nbsp;community leaderboards; and
          (v)&nbsp;conversational query access (“Zobot”). <u>Notwithstanding the
          foregoing</u>, we do not purport to render, nor should any Content be
          construed as rendering, betting, gambling, financial, medical, legal or
          other professional advice.
        </p>
        <p>
          2.2&nbsp;&nbsp;<strong>Right to Modify.</strong> We reserve, and you
          expressly acknowledge, the unrestricted and unilateral right, at any
          time and from time to time, to add to, subtract from, alter, enhance,
          suspend, deprecate or discontinue the Service, or any part thereof,
          whether temporarily or permanently, with or without notice. <em>IF<br/>
          A GIVEN FUNCTION, FEATURE OR DATA SET IS IMPORTANT TO YOU, YOU SHOULD
          MAINTAIN YOUR OWN, INDEPENDENT BACK-UP OR ALTERNATIVE.</em>
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 3. ELIGIBILITY • ACCOUNTS                         */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">
          3. Eligibility; Registration; Security Responsibilities
        </h2>
        <p>
          3.1&nbsp;&nbsp;<strong>Minimum Age.</strong> The Service is intended
          solely for Users who are at least thirteen (13) years of age. By
          accessing the Service, you represent and warrant that you satisfy the
          foregoing age threshold and, where you act on behalf of an organisation,
          that you have full power and authority to bind such organisation to this
          Agreement.
        </p>
        <p>
          3.2&nbsp;&nbsp;<strong>Account Credentials.</strong> You shall (i)&nbsp;provide
          accurate, current and complete registration information, (ii)&nbsp;promptly
          update such information to keep it accurate and complete, (iii)&nbsp;maintain
          the confidentiality of your authentication credentials, and
          (iv)&nbsp;immediately notify us of any unauthorised use or suspected
          breach. YOU ARE SOLELY RESPONSIBLE FOR ALL ACTIVITIES THAT OCCUR UNDER
          YOUR ACCOUNT, WHETHER OR NOT AUTHORISED BY YOU.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 4. MMA INSIGHTS; NO PROFESSIONAL ADVICE           */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">
          4. MMA Insights; No Betting or Professional Advice
        </h2>
        <p>
          All Content—particularly statistics, probability estimates, projections,
          rankings, and AI-generated commentary—is provided solely for the purpose
          of general information and entertainment. You acknowledge that MMA is
          inherently volatile and that past performance is <u>not</u> a reliable
          indicator of future results. You assume the entire risk of any decision
          or transaction that you may initiate in reliance upon the Service.{" "}
          <strong>UNDER NO CIRCUMSTANCES SHALL WE BE DEEMED TO PROVIDE, AND YOU
          AGREE NOT TO CONSTRUE THE SERVICE AS PROVIDING, ANY FORM OF WAGERING
          FACILITATION, FINANCIAL COUNSELLING, OR REGULATED ADVICE.</strong>
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 5. USER CONTENT &amp; LICENCE                     */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">
          5. User Content; Licence Grant; Representations
        </h2>
        <p>
          5.1&nbsp;&nbsp;<strong>Ownership.</strong> As between you and us, you
          retain all right, title and interest in and to your User Content, subject
          to the licence granted below.
        </p>
        <p>
          5.2&nbsp;&nbsp;<strong>Licence.</strong> You hereby grant the Operator a
          non-exclusive, worldwide, royalty-free, transferable, sublicensable
          licence, for the duration of applicable rights, to host, store, index,
          reproduce, adapt, publish, translate, display, transmit and otherwise
          use your User Content <em>solely</em> (a)&nbsp;to provide, secure,
          troubleshoot and improve the Service and related offerings,
          (b)&nbsp;to promote the Service in any media (for example, displaying
          anonymised leaderboard snippets), and (c)&nbsp;to comply with legal
          obligations.
        </p>
        <p>
          5.3&nbsp;&nbsp;<strong>Representations.</strong> You represent and
          warrant that you have all rights necessary to grant the foregoing
          licence, and that neither your User Content nor our authorised use of
          it shall infringe, misappropriate or violate any law or third-party
          right (including privacy, publicity and intellectual-property rights).
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 6. ACCEPTABLE USE                                 */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">6. Acceptable Use Policy</h2>
        <p>
          You shall not, directly or indirectly: (i)&nbsp;infringe or violate any
          applicable law; (ii)&nbsp;attempt to gain unauthorised access to the
          Service or its related systems; (iii)&nbsp;probe, scan or test the
          vulnerability of any system or network; (iv)&nbsp;interfere with
          service-hosted data via malware or disruptive scripts; (v)&nbsp;harvest
          or scrape Content outside any officially documented API rate limits;
          (vi)&nbsp;post or transmit content that is unlawful, defamatory,
          obscene, hateful, or incites violence; (vii)&nbsp;engage in manipulative
          activity designed to distort rankings or leaderboards; or
          (viii)&nbsp;reverse-engineer or de-compile any component except to the
          extent expressly permitted by law notwithstanding contractual
          prohibition.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 7. COMMERCIAL TERMS                               */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">
          7. Paid Features, Trials, Promotions
        </h2>
        <p>
          We may, now or in the future, offer subscription tiers, pay-per-use
          credits, early-access programmes, sponsored content or other monetised
          modules (“<u>Paid Features</u>”). Definitive pricing, billing cycle,
          renewal terms and refund policy for each Paid Feature shall be disclosed
          at the point of transaction and, where relevant, reiterated by email.
          Unless otherwise required by statute, <u>fees are non-refundable once a
          Paid Feature has been provisioned</u>. All amounts are exclusive of
          applicable taxes, which shall be collected as required by law.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 8. THIRD-PARTY LINKS                              */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">
          8. Third-Party Content, Services &amp; Integrations
        </h2>
        <p>
          The Service may contain hyperlinks or integrations leading to, or
          originating from, independent third-party services (e.g., cloud hosting,
          analytics, authentication via AWS Cognito, payment processors, social
          media widgets). Such services are provided solely as a convenience. We
          neither endorse nor assume responsibility for third-party terms,
          policies, practices or content. Your interactions with any third party
          are <u>entirely</u> at your own risk and subject to such third party’s
          governing agreements.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 9. PRIVACY                                        */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">9. Privacy</h2>
        <p>
          Our collection, use, disclosure and retention of personal information
          are governed by our <a href="/privacy" className="underline">Privacy Policy</a>,
          which is hereby incorporated by reference. Where applicable law
          requires consent (for example, for certain cookies, analytics or
          marketing communications), we will seek such consent in advance. By
          using the Service, you acknowledge that your information may be
          processed in accordance with the Privacy Policy.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 10. DISCLAIMERS                                   */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">10. Disclaimers</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE AND ALL
          CONTENT ARE PROVIDED “AS IS”, “AS AVAILABLE” AND WITHOUT WARRANTY OF
          ANY KIND, WHETHER EXPRESS, IMPLIED OR STATUTORY, INCLUDING WITHOUT
          LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, ACCURACY, NON-INFRINGEMENT, OR UNINTERRUPTED OPERATION.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 11. LIMITATION OF LIABILITY                       */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">
          11. Limitation of Liability
        </h2>
        <p>
          NOTWITHSTANDING ANYTHING TO THE CONTRARY AND TO THE FULLEST EXTENT
          PERMITTED BY LAW, (A)&nbsp;IN NO EVENT SHALL THE OPERATOR BE LIABLE FOR
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE
          DAMAGES (INCLUDING LOST PROFITS, DATA, GOODWILL OR BUSINESS
          INTERRUPTION), AND (B)&nbsp;THE OPERATOR’S AGGREGATE LIABILITY ARISING
          OUT OF OR RELATING TO THIS AGREEMENT SHALL NOT EXCEED THE GREATER OF
          (I)&nbsp;ONE HUNDRED CANADIAN DOLLARS (CAD $100) OR
          (II)&nbsp;THE AMOUNT ACTUALLY PAID BY YOU TO THE OPERATOR IN THE TWELVE
          (12) MONTHS PRECEDING THE CLAIM.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 12. INDEMNITY                                     */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">12. Indemnification</h2>
        <p>
          You agree to defend, indemnify and hold harmless the Operator and its
          affiliates, officers, directors, employees and agents from and against
          any and all claims, damages, liabilities, losses, costs and expenses
          (including reasonable legal fees) arising out of or relating to
          (i)&nbsp;your breach of this Agreement, (ii)&nbsp;your User Content, or
          (iii)&nbsp;your misuse of the Service.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 13. TERMINATION                                   */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">13. Termination</h2>
        <p>
          We may suspend or terminate your access to the Service, in whole or in
          part, immediately and without prior notice, if we reasonably believe
          (i)&nbsp;you have violated this Agreement, (ii)&nbsp;such action is
          necessary to protect the Service or other Users, or
          (iii)&nbsp;we are required to do so by law. Sections that by their
          nature should survive termination (including Sections 5, 6, 10, 11,
          12, 14 and 15) shall so survive.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 14. GOVERNING LAW • VENUE                         */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10">
        <h2 className="text-xl font-semibold mb-2">
          14. Governing Law and Venue
        </h2>
        <p>
          This Agreement shall be governed by, and construed in accordance with,
          the laws of the Province of Ontario and the federal laws of Canada
          applicable therein, without regard to its conflict-of-law provisions.
          The parties hereby irrevocably attorn to the exclusive jurisdiction of
          the courts located in Toronto, Ontario, with respect to all disputes
          arising under or in connection with this Agreement.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* 15. MISCELLANEOUS                                 */}
      {/* -------------------------------------------------- */}
      <section className="space-y-3 text-sm leading-relaxed mt-10 mb-8">
        <h2 className="text-xl font-semibold mb-2">15. Miscellaneous</h2>
        <p>
          15.1&nbsp;&nbsp;<strong>Entire Agreement.</strong> This Agreement
          constitutes the complete and exclusive understanding between the
          parties with respect to its subject matter and supersedes all prior or
          contemporaneous oral or written communications.
        </p>
        <p>
          15.2&nbsp;&nbsp;<strong>Severability.</strong> If any provision of this
          Agreement is held invalid or unenforceable, the remaining provisions
          shall remain in full force and effect.
        </p>
        <p>
          15.3&nbsp;&nbsp;<strong>No Waiver.</strong> The failure of either party
          to enforce any right or provision shall not constitute a waiver of
          future enforcement.
        </p>
        <p>
          15.4&nbsp;&nbsp;<strong>Assignment.</strong> The Operator may assign or
          transfer this Agreement, in whole or in part, without restriction. You
          may not assign this Agreement without prior written consent.
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* CONTACT BANNER                                    */}
      {/* -------------------------------------------------- */}
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          Questions? Contact&nbsp;
          <a href="mailto:legal@zocraticmma.com" className="underline">
            contact@zocraticmma.com
          </a>
          &nbsp;or write to&nbsp;
          {`{Zocratic MMA LEGAL ENTITY}, {PLACEHOLDER FULL MAILING ADDRESS}`}.
        </p>
      </div>
    </div>
  );
}
