// ===== src/services/scheduler.js =====

export function autoAssign({ instances, slots, templates, avail, constraints, stats }) {
  const order = { open: 0, close: 1, mid: 2 };
  const sortedSlots = [...slots].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.role.localeCompare(b.role) ||
    order[a.part] - order[b.part] ||
    a.order_index - b.order_index
  );

  const out = [];
  const used = new Set();

  for (const slot of sortedSlots) {
    const candidates = getCandidatesForSlot(slot, avail)
      .filter(u => respectsConstraints(u, slot, constraints, used, stats));

    candidates.sort((u1, u2) => {
      const dW = (stats.weekHours[u1] || 0) - (stats.weekHours[u2] || 0);
      if (dW !== 0) return dW;
      const dM = (stats.monthHours[u1] || 0) - (stats.monthHours[u2] || 0);
      if (dM !== 0) return dM;
      const dS = (stats.seniority[u2] || 0) - (stats.seniority[u1] || 0);
      if (dS !== 0) return dS;
      const p1 = availPref(u1, slot, avail);
      const p2 = availPref(u2, slot, avail);
      return (p2 === 'prefer') - (p1 === 'prefer');
    });

    const picked = candidates[0];
    if (picked) {
      out.push({ slot_id: slot.id, user_id: picked });
      stats.weekHours[picked] = (stats.weekHours[picked] || 0) + slotPlannedHours(slot);
      stats.monthHours[picked] = (stats.monthHours[picked] || 0) + slotPlannedHours(slot);
      used.add(`${picked}:${slot.date}:${slot.shift_type}`);
      if (!constraints.allowDoubleShift) used.add(`${picked}:${slot.date}`);
    }
  }

  return out;
}

// ===== פונקציות עזר =====
function getCandidatesForSlot(slot, avail) {
  return Object.keys(avail)
    .filter(userId => {
      const key = `${userId}:${slot.date}:${slot.shift_type}`;
      const a = avail[key];
      if (!a) return false;
      if (slot.part === 'open' && !a.open) return false;
      if (slot.part === 'mid' && !a.mid) return false;
      if (slot.part === 'close' && !a.close) return false;
      return true;
    })
    .map(Number);
}

function respectsConstraints(userId, slot, constraints, used, stats) {
  if (used.has(`${userId}:${slot.date}:${slot.shift_type}`)) return false;
  if (!constraints.allowDoubleShift && used.has(`${userId}:${slot.date}`)) return false;
  const hours = slotPlannedHours(slot);
  if ((stats.weekHours[userId] || 0) + hours > constraints.maxHours) return false;
  return true;
}

function availPref(userId, slot, avail) {
  const key = `${userId}:${slot.date}:${slot.shift_type}`;
  return (avail[key]?.priority) || 'can';
}

function slotPlannedHours(slot) {
  if (!slot.planned_start || !slot.planned_end) return 0;
  const [sh, sm] = slot.planned_start.split(':').map(Number);
  const [eh, em] = slot.planned_end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}
