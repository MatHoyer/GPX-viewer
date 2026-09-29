package auth

import (
	"fmt"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// email is a message template; %s in body is where the link goes.
type email struct {
	subject, body string
}

type emailSet struct {
	verification, passwordReset, adminReset, invite email
}

// emails holds every email the app sends, per language.
var emails = map[domain.Language]emailSet{
	domain.LanguageEnglish: {
		verification: email{"Confirm your email address", `Welcome to GPX Viewer!

Confirm your email address by opening this link:

%s

The link expires in 24 hours. If you did not create an account, ignore this email.
`},
		passwordReset: email{"Reset your password", `Someone asked to reset the password of your GPX Viewer account.

Choose a new password by opening this link:

%s

The link expires in 1 hour. If you did not ask for this, ignore this email; your password stays the same.
`},
		adminReset: email{"Choose a new password", `An admin of GPX Viewer sent you a link to choose a new password:

%s

The link expires in 24 hours. Your current password works until you use it.
`},
		invite: email{"You're invited to GPX Viewer", `You have been invited to GPX Viewer!

Choose a password to finish creating your account:

%s

The link expires in 7 days.
`},
	},
	domain.LanguageFrench: {
		verification: email{"Confirmez votre adresse e-mail", `Bienvenue sur GPX Viewer !

Confirmez votre adresse e-mail en ouvrant ce lien :

%s

Le lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet e-mail.
`},
		passwordReset: email{"Réinitialisez votre mot de passe", `Quelqu'un a demandé à réinitialiser le mot de passe de votre compte GPX Viewer.

Choisissez un nouveau mot de passe en ouvrant ce lien :

%s

Le lien expire dans 1 heure. Si vous n'avez rien demandé, ignorez cet e-mail ; votre mot de passe reste le même.
`},
		adminReset: email{"Choisissez un nouveau mot de passe", `Un administrateur de GPX Viewer vous a envoyé un lien pour choisir un nouveau mot de passe :

%s

Le lien expire dans 24 heures. Votre mot de passe actuel fonctionne jusqu'à ce que vous l'utilisiez.
`},
		invite: email{"Vous êtes invité sur GPX Viewer", `Vous avez été invité sur GPX Viewer !

Choisissez un mot de passe pour finir de créer votre compte :

%s

Le lien expire dans 7 jours.
`},
	},
}

// emailsIn returns the emails in lang, in English when the user never picked
// a language.
func emailsIn(lang domain.Language) emailSet {
	if set, ok := emails[lang]; ok {
		return set
	}
	return emails[domain.LanguageEnglish]
}

// render fills in the link.
func (e email) render(link string) (subject, body string) {
	return e.subject, fmt.Sprintf(e.body, link)
}
