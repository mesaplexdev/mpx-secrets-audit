/**
 * PDF Report Generator for mpx-secrets-audit
 * 
 * Generates professional secrets audit reports using PDFKit.
 * Style consistent with mpx-scan and mpx-api PDF reports.
 */

import { createWriteStream } from 'fs';
import { createRequire } from 'module';
import { calculateAge, daysUntilExpiry, getStatusMessage, calculateStatus } from './status.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Color palette (consistent with mpx-scan / mpx-api)
const COLORS = {
  primary: '#1a56db',
  dark: '#1f2937',
  gray: '#6b7280',
  lightGray: '#e5e7eb',
  white: '#ffffff',
  healthy: '#16a34a',
  warning: '#ea580c',
  critical: '#dc2626',
  expired: '#991b1b',
  headerBg: '#1e3a5f',
  sectionBg: '#f3f4f6',
};

const STATUS_LABELS = {
  healthy: '🟢 HEALTHY',
  warning: '🟡 WARNING',
  critical: '🔴 CRITICAL',
  expired: '⛔ EXPIRED',
};

/**
 * Generate a PDF report from secrets data
 * @param {Array} secrets - Array of secret objects
 * @param {string} outputPath - Path to write the PDF
 * @returns {Promise<string>} - Resolved path of the generated PDF
 */
export async function generatePDFReport(secrets, outputPath) {
  // Lazy-load pdfkit
  let PDFDocument;
  try {
    PDFDocument = (await import('pdfkit')).default;
  } catch {
    throw new Error(
      'pdfkit is required for PDF export. Install with: npm install pdfkit'
    );
  }

  return new Promise((resolve, reject) => {
    try {
      const now = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      // Recalculate statuses
      secrets.forEach(s => { s.status = calculateStatus(s); });

      const summary = {
        total: secrets.length,
        healthy: secrets.filter(s => s.status === 'healthy').length,
        warning: secrets.filter(s => s.status === 'warning').length,
        critical: secrets.filter(s => s.status === 'critical').length,
        expired: secrets.filter(s => s.status === 'expired').length,
      };

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: 'mpx-secrets-audit Report',
          Author: 'mpx-secrets-audit',
          Subject: 'Secrets Audit Report',
          Creator: `mpx-secrets-audit v${pkg.version}`,
        },
        bufferPages: true,
      });

      const stream = createWriteStream(outputPath);
      doc.pipe(stream);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ─── Header ───
      doc.rect(0, 0, doc.page.width, 100).fill(COLORS.headerBg);
      doc.fontSize(22).fillColor(COLORS.white).font('Helvetica-Bold')
        .text('Secrets Audit Report', 50, 30);
      doc.fontSize(10).fillColor('#a0b4cc').font('Helvetica')
        .text(`mpx-secrets-audit v${pkg.version}  •  ${now}`, 50, 60);

      doc.y = 120;

      // ─── Summary Box ───
      const healthRate = summary.total > 0 ? Math.round((summary.healthy / summary.total) * 100) : 100;
      const gradeColor = healthRate >= 80 ? COLORS.healthy : healthRate >= 50 ? COLORS.warning : COLORS.critical;

      doc.roundedRect(50, doc.y, pageWidth, 80, 6).fill(COLORS.sectionBg);
      const summaryTop = doc.y + 12;

      // Health circle
      doc.circle(100, summaryTop + 28, 26).fill(gradeColor);
      doc.fontSize(20).fillColor(COLORS.white).font('Helvetica-Bold')
        .text(`${healthRate}%`, 100 - 20, summaryTop + 16, { width: 40, align: 'center' });

      // Summary text
      doc.fontSize(14).fillColor(COLORS.dark).font('Helvetica-Bold')
        .text(`${summary.total} secret${summary.total === 1 ? '' : 's'} tracked`, 145, summaryTop + 5);
      doc.fontSize(10).fillColor(COLORS.gray).font('Helvetica')
        .text(`${summary.healthy} healthy  •  ${summary.warning + summary.critical + summary.expired} need attention`, 145, summaryTop + 25);

      // Counts on right
      const countsX = 340;
      const counts = [
        { label: 'Healthy', count: summary.healthy, color: COLORS.healthy },
        { label: 'Warning', count: summary.warning, color: COLORS.warning },
        { label: 'Critical', count: summary.critical, color: COLORS.critical },
        { label: 'Expired', count: summary.expired, color: COLORS.expired },
      ];
      counts.forEach((c, i) => {
        const cx = countsX + i * 55;
        doc.fontSize(18).fillColor(c.color).font('Helvetica-Bold')
          .text(String(c.count), cx, summaryTop + 5, { width: 50, align: 'center' });
        doc.fontSize(7).fillColor(COLORS.gray).font('Helvetica')
          .text(c.label, cx, summaryTop + 28, { width: 50, align: 'center' });
      });

      doc.y = summaryTop + 68;

      // ─── Secrets Inventory ───
      if (secrets.length > 0) {
        doc.y += 10;
        doc.roundedRect(50, doc.y, pageWidth, 28, 4).fill(COLORS.primary);
        doc.fontSize(11).fillColor(COLORS.white).font('Helvetica-Bold')
          .text('Secrets Inventory', 60, doc.y + 7);
        doc.y += 35;

        // Table header
        doc.fontSize(8).fillColor(COLORS.gray).font('Helvetica-Bold');
        doc.text('Status', 60, doc.y, { width: 60 });
        doc.text('Name', 125, doc.y, { width: 120 });
        doc.text('Provider', 250, doc.y, { width: 70 });
        doc.text('Age (days)', 325, doc.y, { width: 60 });
        doc.text('Expires', 390, doc.y, { width: 70 });
        doc.text('Rotation', 465, doc.y, { width: 60 });
        doc.y += 14;

        // Separator
        doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y)
          .strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();
        doc.y += 6;

        for (const secret of secrets) {
          if (doc.y > doc.page.height - 100) {
            doc.addPage();
            doc.y = 50;
          }

          const statusColor = COLORS[secret.status] || COLORS.gray;
          const age = calculateAge(secret);
          const expiry = daysUntilExpiry(secret);
          const expiryStr = expiry !== null ? `${expiry}d` : 'N/A';

          // Status indicator
          doc.circle(67, doc.y + 4, 4).fill(statusColor);

          doc.fontSize(9).fillColor(COLORS.dark).font('Helvetica');
          doc.text(secret.status.toUpperCase(), 75, doc.y, { width: 50 });
          doc.font('Helvetica-Bold').text(secret.name, 125, doc.y, { width: 120 });
          doc.font('Helvetica').text(secret.provider || 'N/A', 250, doc.y, { width: 70 });
          doc.text(age !== null ? String(age) : 'N/A', 325, doc.y, { width: 60 });

          // Color-code expiry
          if (expiry !== null && expiry < 7) {
            doc.fillColor(COLORS.critical);
          } else if (expiry !== null && expiry < 30) {
            doc.fillColor(COLORS.warning);
          }
          doc.text(expiryStr, 390, doc.y, { width: 70 });
          doc.fillColor(COLORS.dark);
          doc.text(secret.rotationPolicy ? `${secret.rotationPolicy}d` : 'N/A', 465, doc.y, { width: 60 });

          doc.y += 16;
        }
      }

      // ─── Risk Assessment ───
      const atRisk = secrets.filter(s => s.status !== 'healthy');
      if (atRisk.length > 0) {
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
          doc.y = 50;
        }

        doc.y += 15;
        doc.roundedRect(50, doc.y, pageWidth, 28, 4).fill(COLORS.critical);
        doc.fontSize(11).fillColor(COLORS.white).font('Helvetica-Bold')
          .text('Risk Assessment & Recommendations', 60, doc.y + 7);
        doc.y += 35;

        // Sort: expired first, then critical, then warning
        const severityOrder = { expired: 0, critical: 1, warning: 2 };
        atRisk.sort((a, b) => (severityOrder[a.status] ?? 9) - (severityOrder[b.status] ?? 9));

        for (const secret of atRisk) {
          if (doc.y > doc.page.height - 100) {
            doc.addPage();
            doc.y = 50;
          }

          const statusColor = COLORS[secret.status] || COLORS.gray;
          const message = getStatusMessage(secret);

          // Severity bar
          doc.roundedRect(50, doc.y, pageWidth, 22, 3).fill(statusColor);
          doc.fontSize(9).fillColor(COLORS.white).font('Helvetica-Bold')
            .text(`${secret.status.toUpperCase()} — ${secret.name}`, 60, doc.y + 6);
          doc.y += 28;

          // Details
          doc.fontSize(9).fillColor(COLORS.dark).font('Helvetica')
            .text(`Issue: ${message}`, 60, doc.y, { width: pageWidth - 20 });
          doc.y += 14;

          // Recommendation
          const recommendation = getRecommendation(secret);
          doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Oblique')
            .text(`→ ${recommendation}`, 60, doc.y, { width: pageWidth - 20 });
          doc.y += doc.heightOfString(`→ ${recommendation}`, { width: pageWidth - 20, fontSize: 8 }) + 10;
        }
      }

      // ─── Expiration Timeline ───
      const withExpiry = secrets.filter(s => s.expiresAt);
      if (withExpiry.length > 0) {
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
          doc.y = 50;
        }

        doc.y += 15;
        doc.roundedRect(50, doc.y, pageWidth, 28, 4).fill(COLORS.primary);
        doc.fontSize(11).fillColor(COLORS.white).font('Helvetica-Bold')
          .text('Expiration Timeline', 60, doc.y + 7);
        doc.y += 35;

        // Sort by expiry date
        withExpiry.sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));

        for (const secret of withExpiry) {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
            doc.y = 50;
          }

          const expiry = daysUntilExpiry(secret);
          const statusColor = expiry < 0 ? COLORS.expired : expiry < 7 ? COLORS.critical : expiry < 30 ? COLORS.warning : COLORS.healthy;

          doc.circle(67, doc.y + 4, 4).fill(statusColor);
          doc.fontSize(9).fillColor(COLORS.dark).font('Helvetica-Bold')
            .text(secret.name, 80, doc.y, { width: 150 });
          doc.font('Helvetica')
            .text(secret.expiresAt, 235, doc.y, { width: 80 });

          if (expiry < 0) {
            doc.fillColor(COLORS.expired).text(`Expired ${Math.abs(expiry)}d ago`, 320, doc.y, { width: 120 });
          } else {
            doc.fillColor(statusColor).text(`${expiry} days remaining`, 320, doc.y, { width: 120 });
          }

          doc.y += 16;
        }
      }

      // ─── Footer on every page ───
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const footerY = doc.page.height - 35;
        doc.fontSize(7).fillColor(COLORS.gray).font('Helvetica')
          .text(
            `Generated by mpx-secrets-audit v${pkg.version} on ${now}`,
            50, footerY, { width: pageWidth, align: 'center' }
          );
        doc.text(
          `Page ${i + 1} of ${range.count}`,
          50, footerY + 12, { width: pageWidth, align: 'center' }
        );
      }

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get rotation/remediation recommendation for a secret
 */
function getRecommendation(secret) {
  switch (secret.status) {
    case 'expired':
      return `Immediately rotate this ${secret.type || 'secret'} from ${secret.provider || 'the provider'}. Expired secrets pose an active security risk.`;
    case 'critical':
      if (secret.expiresAt && daysUntilExpiry(secret) < 7) {
        return `This secret expires very soon. Schedule rotation now to avoid service disruption.`;
      }
      return `This secret has exceeded its ${secret.rotationPolicy}-day rotation policy. Rotate as soon as possible.`;
    case 'warning':
      if (secret.expiresAt && daysUntilExpiry(secret) < 30) {
        return `Plan rotation before expiry date (${secret.expiresAt}). Consider setting up automated rotation.`;
      }
      return `Approaching rotation deadline. Schedule rotation within the next ${Math.max(1, secret.rotationPolicy - (calculateAge(secret) || 0))} days.`;
    default:
      return 'No action required.';
  }
}
