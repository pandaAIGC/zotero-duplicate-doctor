var DuplicateDoctorPrefs = {
  async exportNonDuplicates(win) {
    await Zotero.DuplicateDoctor.exportNonDuplicates(win);
  },

  async importNonDuplicates(win) {
    await Zotero.DuplicateDoctor.importNonDuplicates(win);
  },
};
