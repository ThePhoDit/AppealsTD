import {
    ButtonInteraction,
    Client, Message,
    MessageActionRow,
    MessageButton,
    MessageEmbed
} from "discord.js"
import Appeal from "./database/Appeal";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import commands from "./commands";
import Blocked from "./database/Blocked";
import mongoose from "mongoose";

const client = new Client({
    intents: ["GUILDS", "GUILD_BANS", "DIRECT_MESSAGES"]
})

const _commands = [];

for (const command of commands) {
    _commands.push(command.toJSON());
}

// @ts-ignore
const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log('Cargando todos los comandos... (/)');

        // @ts-ignore
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('Todos los comandos han sido recargados! (/)');
    } catch (error) {
        console.error(error);
    }
})();

client.on("ready", () => {
    client.user?.setPresence({ status: 'invisible', activities: [{ name: "TutoDiscord", type: "WATCHING" }] });
    console.log(`Bot iniciado como ${client.user?.username}!`)
});

client.on("interactionCreate", async (interaction) => {

    //@ts-ignore
    if (!interaction.member.roles.cache.find(r => r.id === process.env.ROL_MODERADOR)) return interaction.reply({
        content: ":no_entry_sign:  No tienes permisos para realizar esta acción!",
        ephemeral: true
    })

    if (interaction.isButton()) {

        let args = interaction.customId.split("-")

        if (args[0] !== "btn") return
        if (args[1] === "yes") return await voteYes(args[2], interaction)
        if (args[1] === "no") return await voteNo(args[2], interaction)

        if (args[1] === "end") {

            if (!process.env.ADMINISTRADORES?.split(",").includes(interaction.user.id)) return interaction.reply({
                content: `<:warning:947793548646940712>  No puedes terminar esta votación.`,
                ephemeral: true
            });

            let AppealID = args[2]

            let _Appeal: any = await Appeal.findOne({ AppealID })
            if (!_Appeal) return interaction.reply({
                content: ":no_entry_sign:  Esta petición de apelación no existe!",
                ephemeral: true
            })

            if (_Appeal.ClickersYes.length > _Appeal.ClickersNo.length) return unbanUser(interaction)
            if (_Appeal.ClickersNo.length > _Appeal.ClickersYes.length) return banUser(interaction)
            if (_Appeal.ClickersYes.length == _Appeal.ClickersNo.length) return unbanUser(interaction)

        }
    }

    if (interaction.isCommand()) {

        switch (interaction.commandName) {

            case "appeal":

                let voto = interaction.options.data.find(cmd => cmd.name == "voto");
                let id = interaction.options.data.find(cmd => cmd.name == "id")

                if (voto?.value == "ban") {

                    let _Appeal: any = await Appeal.findOne({ AppealID: id?.value, Unbanned: false })
                    if (!_Appeal) return interaction.reply({
                        content: ":no_entry_sign:  Esta petición de apelación no existe!",
                        ephemeral: true
                    })

                    if (_Appeal.ClickersNo.includes(interaction.user.id)) return interaction.reply({
                        content: `<:warning:947793548646940712>  Ya has votado **banear** al usuario <@!${_Appeal.UserID}>.`,
                        ephemeral: true
                    });

                    if (_Appeal.ClickersYes.includes(interaction.user.id)) {
                        _Appeal.ClickersYes = _Appeal.ClickersYes.filter((item: any) => item !== interaction.user.id)
                    }
                    await interaction.reply({
                        content: `<:tick:947793548781166622>  Has votado **banear** al usuario <@!${_Appeal.UserID}>.`,
                        ephemeral: true
                    });
                    _Appeal.ClickersNo.push(interaction.user.id)
                    _Appeal.save();

                    let all = _Appeal.ClickersYes.length + _Appeal.ClickersNo.length
                    let yesVotes = Math.round(_Appeal.ClickersYes.length / all * 10)
                    let noVotes = Math.round(_Appeal.ClickersNo.length / all * 10)

                    let string;
                    if (yesVotes === 10) string = "<:Green1:947790746650546186>" + "<:Green2:947790746315010050>".repeat(yesVotes) + "<:Green3:947790746650562610>"
                    if (noVotes === 10) string = "<:Red1:947787900697845822>" + "<:Red2:947787900785938432>".repeat(noVotes) + "<:Red3:947787900458762281>"

                    if (!string)
                        string = "<:Green1:947790746650546186>" + "<:Green2:947790746315010050>".repeat(yesVotes) + "<:Red2:947787900785938432>".repeat(noVotes) + "<:Red3:947787900458762281>"

                    // @ts-ignore
                    let channel = interaction.guild?.channels.cache.get(process.env.CHANNEL_ID)
                    if (!channel) return interaction.reply({
                        content: ":no_entry_sign:  Esta petición de apelación no existe!",
                        ephemeral: true
                    })

                    let msg: any = undefined;
                    try {
                        // @ts-ignore
                        msg = await channel.messages.fetch(_Appeal.MessageID);
                    } catch (e) {
                        return interaction.reply({
                            content: ":no_entry_sign:  Esta petición de apelación no existe!",
                            ephemeral: true
                        });
                    }
                    if (!msg) return interaction.reply({
                        content: ":no_entry_sign:  Esta petición de apelación no existe!",
                        ephemeral: true
                    });

                    let embed = msg.embeds[0]
                    embed.setDescription(`Progreso de la votación:\n\n \`[${_Appeal.ClickersYes.length}/${all}]\` ${string} \`[${_Appeal.ClickersNo.length}/${all}]\`\n`)
                    msg.edit({ embeds: [embed] })

                }
                if (voto?.value == "unban") {

                    let _Appeal: any = await Appeal.findOne({ AppealID: id?.value, Unbanned: false })
                    if (!_Appeal) return interaction.reply({
                        content: ":no_entry_sign:  Esta petición de apelación no existe!",
                        ephemeral: true
                    })

                    if (_Appeal.ClickersYes.includes(interaction.user.id)) return interaction.reply({
                        content: `<:warning:947793548646940712>  Ya has votado **desbanear** al usuario <@!${_Appeal.UserID}>.`,
                        ephemeral: true
                    });

                    if (_Appeal.ClickersNo.includes(interaction.user.id)) {
                        _Appeal.ClickersNo = _Appeal.ClickersNo.filter((item: any) => item !== interaction.user.id)
                    }

                    await interaction.reply({
                        content: `<:tick:947793548781166622>  Has votado **desbanear** al usuario <@!${_Appeal.UserID}>.`,
                        ephemeral: true
                    });
                    _Appeal.ClickersYes.push(interaction.user.id)
                    _Appeal.save();

                    let all = _Appeal.ClickersYes.length + _Appeal.ClickersNo.length
                    let yesVotes = Math.round(_Appeal.ClickersYes.length / all * 10)
                    let noVotes = Math.round(_Appeal.ClickersNo.length / all * 10)

                    let string;
                    if (yesVotes === 10) string = "<:Green1:947790746650546186>" + "<:Green2:947790746315010050>".repeat(yesVotes) + "<:Green3:947790746650562610>"
                    if (noVotes === 10) string = "<:Red1:947787900697845822>" + "<:Red2:947787900785938432>".repeat(noVotes) + "<:Red3:947787900458762281>"

                    if (!string)
                        string = "<:Green1:947790746650546186>" + "<:Green2:947790746315010050>".repeat(yesVotes) + "<:Red2:947787900785938432>".repeat(noVotes) + "<:Red3:947787900458762281>"

                    // @ts-ignore
                    let channel = interaction.guild?.channels.cache.get(process.env.CHANNEL_ID)
                    if (!channel) return interaction.reply({
                        content: ":no_entry_sign:  Esta petición de apelación no existe!",
                        ephemeral: true
                    })

                    let msg: any = undefined;
                    try {
                        // @ts-ignore
                        msg = await channel.messages.fetch(_Appeal.MessageID);
                    } catch (e) {
                        return interaction.reply({
                            content: ":no_entry_sign:  Esta petición de apelación no existe!",
                            ephemeral: true
                        });
                    }
                    if (!msg) return interaction.reply({
                        content: ":no_entry_sign:  Esta petición de apelación no existe!",
                        ephemeral: true
                    });

                    let embed = msg.embeds[0]
                    embed.setDescription(`Progreso de la votación:\n\n \`[${_Appeal.ClickersYes.length}/${all}]\` ${string} \`[${_Appeal.ClickersNo.length}/${all}]\`\n`)
                    msg.edit({ embeds: [embed] })

                }
                break;

            case "block":

                if (!interaction.options.data[0]) return interaction.reply({
                    content: ":no_entry_sign:  Ese usuario no existe",
                    ephemeral: true
                });

                Blocked.findOne({
                    ID: interaction.options.data[0].user?.id
                }, (err: any, res: any) => {
                    if (err || res) return interaction.reply({
                        content: ":no_entry_sign:  Ese usuario ya está bloqueado",
                        ephemeral: true
                    });

                    new Blocked({
                        _id: new mongoose.Types.ObjectId(),
                        ID: interaction.options.data[0].user?.id
                    }).save().then(doc => {
                        return interaction.reply({
                            content: `<:tick:947793548781166622>  El usuario **${interaction.options.data[0].user?.tag}** ha sido bloqueado.`,
                        }).catch(e => {
                            console.log(e)
                            return interaction.reply({
                                content: ":no_entry_sign:  Ha ocurrido un error!",
                                ephemeral: true
                            });
                        });
                    })
                })
                break;

            case "unblock":

                if (!interaction.options.data[0]) return interaction.reply({
                    content: ":no_entry_sign:  Ese usuario no existe",
                    ephemeral: true
                });

                Blocked.findOne({
                    ID: interaction.options.data[0].user?.id
                }, (err: any, res: any) => {
                    if (err || !res) return interaction.reply({
                        content: ":no_entry_sign:  Ese usuario no está bloqueado",
                        ephemeral: true
                    });

                    res.delete();
                    return interaction.reply({
                        content: `<:tick:947793548781166622>  El usuario **${interaction.options.data[0].user?.tag}** ha sido desbloqueado.`,
                    })
                })
                break;
        }
    }

})

export async function checkBans(userId: any) {
    // @ts-ignore
    let guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return false
    try {
        let bans = await guild.bans.fetch();
        return bans.has(userId)
    } catch (e) {
        console.log("No tengo permisos para ver los bans del servidor!")
        return false
    }
}

export async function getBanByUserID(userId: any) {
    // @ts-ignore
    let guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return false
    try {
        let bans = await guild.bans.fetch();
        return bans.get(userId) || false
    } catch (e) {
        console.log("No tengo permisos para ver los bans del servidor!")
        return false
    }
}

export async function sendAppealEmbed(user: any, _appeal: any) {

    // @ts-ignore
    let guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return false
    // @ts-ignore
    let channel = guild.channels.cache.get(process.env.CHANNEL_ID)
    if (!channel || channel.type !== "GUILD_TEXT") return false;

    let ban = guild.bans.cache.get(user.ID)
    if (!ban) return false;

    let reason = ban.reason || "Sin razón"
    if (!reason) return false;

    let appeal = await _appeal
    if (!appeal) return false;
    let progress = "<:Grey2:947792446371299349>".repeat(10)

    let embed = new MessageEmbed()
        .setColor("#2cfff7")
        .setAuthor("¡ Nueva apelación recibida !", "https://i.phodit.xyz/oKA7KWDv6")
        .setThumbnail(`https://cdn.discordapp.com/avatars/${user.ID}/${user.Avatar}.webp`)
        .addField("Información del usuario:", `- Usuario: <@!${user.ID}>\n- Nombre: \`${user.Tag}\`\n- ID: \`${user.ID}\`\n\n- ID del caso: \`${appeal.AppealID}\`\n- Razón del baneo: \`${reason}\``, false)
        .addField("¿Por qué has sido baneado?", appeal.banReason, false)
        .addField("¿Por qué crees que deberíamos levantarte el ban?", appeal.appealText, false)
        .addField("¿Qué harás para evitar ser baneado en el futuro?", appeal.futureActions, false)

        .setDescription(`Progreso de la votación:\n\n \`[0/0]\` <:Grey1:947792446622945310>${progress}<:Grey3:947792446585200650> \`[0/0]\`\n`)

    let voteYesButton = new MessageButton()
        .setStyle("SUCCESS")
        .setLabel("Desbanear")
        .setEmoji("947793548781166622")
        .setCustomId(`btn-yes-${appeal.AppealID}`)

    let voteNoButton = new MessageButton()
        .setStyle("DANGER")
        .setLabel("Banear")
        .setEmoji("947793548454002689")
        .setCustomId(`btn-no-${appeal.AppealID}`)

    let endButton = new MessageButton()
        .setStyle("PRIMARY")
        .setLabel("Terminar votación")
        .setEmoji("⌛ ")
        .setCustomId(`btn-end-${appeal.AppealID}`)
    try {
        //@ts-ignore
        let msg = await channel.send({
            embeds: [embed],
            components: [new MessageActionRow().addComponents(voteYesButton, voteNoButton, endButton)]
        })

        let user: any = await Appeal.findOne(
            {
                AppealID: appeal.AppealID
            });

        if (!user) return false;
        user.MessageID = msg.id;
        user.save();
        return true;
    } catch (e) {
        console.log("No se ha podido mandar el mensaje: " + e)
        return false
    }
}
export function start() {
    client.login(process.env.BOT_TOKEN).catch()
}
async function voteYes(AppealID: any, interaction: ButtonInteraction) {

    let _Appeal: any = await Appeal.findOne({ AppealID })
    if (!_Appeal) return interaction.reply({
        content: ":no_entry_sign:  Esta petición de apelación no existe!",
        ephemeral: true
    })

    if (_Appeal.ClickersYes.includes(interaction.user.id)) return interaction.reply({
        content: `<:warning:947793548646940712>  Ya has votado **desbanear** al usuario <@!${_Appeal.UserID}>.`,
        ephemeral: true
    });

    if (_Appeal.ClickersNo.includes(interaction.user.id)) {
        _Appeal.ClickersNo = _Appeal.ClickersNo.filter((item: any) => item !== interaction.user.id)
    }

    await interaction.reply({
        content: `<:tick:947793548781166622>  Has votado **desbanear** al usuario <@!${_Appeal.UserID}>.`,
        ephemeral: true
    });
    _Appeal.ClickersYes.push(interaction.user.id)
    _Appeal.save();

    let all = _Appeal.ClickersYes.length + _Appeal.ClickersNo.length
    let yesVotes = Math.round(_Appeal.ClickersYes.length / all * 10)
    let noVotes = Math.round(_Appeal.ClickersNo.length / all * 10)

    let string;
    if (yesVotes === 10) string = "<:Green1:947790746650546186>" + "<:Green2:947790746315010050>".repeat(yesVotes) + "<:Green3:947790746650562610>"
    if (noVotes === 10) string = "<:Red1:947787900697845822>" + "<:Red2:947787900785938432>".repeat(noVotes) + "<:Red3:947787900458762281>"

    if (!string)
        string = "<:Green1:947790746650546186>" + "<:Green2:947790746315010050>".repeat(yesVotes) + "<:Red2:947787900785938432>".repeat(noVotes) + "<:Red3:947787900458762281>"

    let embed = interaction.message.embeds[0]
    //@ts-ignore
    embed.setDescription(`Progreso de la votación:\n\n \`[${_Appeal.ClickersYes.length}/${all}]\` ${string} \`[${_Appeal.ClickersNo.length}/${all}]\`\n`)
    //@ts-ignore
    interaction.message.edit({ embeds: [embed] })

    try {
        await interaction.user.send({ content: `Hola :wave: <@!${interaction.user.id}>\nHas votado **desbanear** en la apelación de <@!${_Appeal.UserID}>. ¿Puedes argumentar tu voto?\n\`Puedes esperar 5 minutos o decir no para no argumentar\`` })
    } catch (e) {
        let Embed = new MessageEmbed()
            .setColor("#57F287")
            .setAuthor(`Voto a favor de ${interaction.user.tag}`, `${interaction.user.avatarURL()}`)
            .setDescription(`Apelación de: <@!${_Appeal.UserID}> (${_Appeal.UserID}) con id: \`${_Appeal.AppealID}\``)
        //@ts-ignore
        return interaction.guild?.channels.cache.get(process.env.ARGUMENT_CHANNEL_ID).send({ embeds: [Embed] }).catch(() => { })

    }
    const filter = (m: any) => m.content !== "" && !m.author.bot;
    const collector = interaction.user.dmChannel?.createMessageCollector({ filter: filter, max: 1, time: 300000 })

    collector?.on("collect", (msg: Message) => {
        msg.react("✅")
        if (msg.content.toLowerCase() == "no") return collector?.stop("no")
        return collector?.stop(msg.content)
    })
    collector?.on("end", (collected: any, reason: any) => {
        let Embed = new MessageEmbed()
            .setColor("#57F287")
            .setAuthor(`Voto a favor de ${interaction.user.tag}`, `${interaction.user.avatarURL()}`)
            .setDescription(`Apelación de: <@!${_Appeal.UserID}> (${_Appeal.UserID}) con id: \`${_Appeal.AppealID}\``)

        if (reason == "no" || reason == "time") //@ts-ignore
            return interaction.guild?.channels.cache.get(process.env.ARGUMENT_CHANNEL_ID).send({ embeds: [Embed] })

        Embed.addField("Argumentación: ", reason)
        //@ts-ignore
        interaction.guild?.channels.cache.get(process.env.ARGUMENT_CHANNEL_ID).send({ embeds: [Embed] })
    })
}
async function voteNo(AppealID: any, interaction: ButtonInteraction) {

    let _Appeal: any = await Appeal.findOne({ AppealID })
    if (!_Appeal) return interaction.reply({
        content: ":no_entry_sign:  Esta petición de apelación no existe!",
        ephemeral: true
    })

    if (_Appeal.ClickersNo.includes(interaction.user.id)) return interaction.reply({
        content: `<:warning:947793548646940712>  Ya has votado **banear** al usuario <@!${_Appeal.UserID}>.`,
        ephemeral: true
    });

    if (_Appeal.ClickersYes.includes(interaction.user.id)) {
        _Appeal.ClickersYes = _Appeal.ClickersYes.filter((item: any) => item !== interaction.user.id)
    }
    await interaction.reply({
        content: `<:tick:947793548781166622>  Has votado **banear** al usuario <@!${_Appeal.UserID}>.`,
        ephemeral: true
    });
    _Appeal.ClickersNo.push(interaction.user.id)
    _Appeal.save();

    let all = _Appeal.ClickersYes.length + _Appeal.ClickersNo.length
    let yesVotes = Math.round(_Appeal.ClickersYes.length / all * 10)
    let noVotes = Math.round(_Appeal.ClickersNo.length / all * 10)

    let string;
    if (yesVotes === 10) string = "<:Green1:947790746650546186>" + "<:Green2:947790746315010050>".repeat(yesVotes) + "<:Green3:947790746650562610>"
    if (noVotes === 10) string = "<:Red1:947787900697845822>" + "<:Red2:947787900785938432>".repeat(noVotes) + "<:Red3:947787900458762281>"

    if (!string)
        string = "<:Green1:947790746650546186>" + "<:Green2:947790746315010050>".repeat(yesVotes) + "<:Red2:947787900785938432>".repeat(noVotes) + "<:Red3:947787900458762281>"

    let embed = interaction.message.embeds[0]
    //@ts-ignore
    embed.setDescription(`Progreso de la votación:\n\n \`[${_Appeal.ClickersYes.length}/${all}]\` ${string} \`[${_Appeal.ClickersNo.length}/${all}]\`\n`)
    //@ts-ignore
    interaction.message.edit({ embeds: [embed] })

    try {
        await interaction.user.send({ content: `Hola :wave: <@!${interaction.user.id}>\nHas votado **banear** en la apelación de <@!${_Appeal.UserID}>. ¿Puedes argumentar tu voto?\n\`Puedes esperar 5 minutos o decir no para no argumentar\`` })
    } catch (e) {
        let Embed = new MessageEmbed()
            .setColor("#ED4245")
            .setAuthor(`Voto en contra de ${interaction.user.tag}`, `${interaction.user.avatarURL()}`)
            .setDescription(`Apelación de: <@!${_Appeal.UserID}> (${_Appeal.UserID}) con id: \`${_Appeal.AppealID}\``)
        //@ts-ignore
        return interaction.guild?.channels.cache.get(process.env.ARGUMENT_CHANNEL_ID).send({ embeds: [Embed] }).catch(() => { })
    }
    const filter = (m: any) => m.content !== "";
    const collector = interaction.user.dmChannel?.createMessageCollector({ filter: filter, max: 1, time: 300000 })

    collector?.on("collect", (msg: Message) => {
        msg.react("✅")
        if (msg.content.toLowerCase() == "no") return collector?.stop("no")
        return collector?.stop(msg.content)
    })
    collector?.on("end", (collected: any, reason: any) => {
        let Embed = new MessageEmbed()
            .setColor("#ED4245")
            .setAuthor(`Voto en contra de ${interaction.user.tag}`, `${interaction.user.avatarURL()}`)
            .setDescription(`Apelación de: <@!${_Appeal.UserID}> (${_Appeal.UserID}) con id: \`${_Appeal.AppealID}\``)

        if (reason == "no" || reason == "time") //@ts-ignore
            return interaction.guild?.channels.cache.get(process.env.ARGUMENT_CHANNEL_ID).send({ embeds: [Embed] })

        Embed.addField("Argumentación: ", reason)
        //@ts-ignore
        interaction.guild?.channels.cache.get(process.env.ARGUMENT_CHANNEL_ID).send({ embeds: [Embed] })
    })
}
function unbanUser(interaction: ButtonInteraction) {

    let args = interaction.customId.split("-")
    // @ts-ignore
    let channel = interaction.guild?.channels.cache.get(process.env.CHANNEL_ID)
    if (!channel || channel.type !== "GUILD_TEXT") return;

    Appeal.findOne({ AppealID: args[2], Unbanned: false }, (err: any, res: any) => {
        if (!res) return interaction.reply({
            content: ":no_entry_sign:  Esta votación ya ha acabado!",
            ephemeral: true
        })

        res.Unbanned = true;
        res.save();

        let _voteYesButton = new MessageButton()
            .setStyle("SUCCESS")
            .setLabel("Desbanear")
            .setEmoji("947793548781166622")
            .setDisabled(true)
            .setCustomId(`btn-yes-${res.AppealID}`)

        let _voteNoButton = new MessageButton()
            .setStyle("DANGER")
            .setLabel("Banear")
            .setEmoji("947793548454002689")
            .setDisabled(true)
            .setCustomId(`btn-no-${res.AppealID}`)

        let _endButton = new MessageButton()
            .setStyle("PRIMARY")
            .setLabel("Terminar votación")
            .setEmoji("⌛ ")
            .setDisabled(true)
            .setCustomId(`btn-end-${res.AppealID}`)

        let embed = interaction.message.embeds[0]
        //@ts-ignore
        embed.setColor("#57F287").setAuthor("Usuario desbaneado", "https://i.phodit.xyz/oKA7KWDv6")

        //@ts-ignore
        interaction.message.edit({
            components: [new MessageActionRow().addComponents(_voteYesButton, _voteNoButton, _endButton)],
            embeds: [embed]
        }).catch((e: any) => {
        })

        try {
            interaction.guild?.bans.remove(res.UserID, "Apelación aprobada").catch(e => { })
            return interaction.reply({
                content: "<:tick:947793548781166622>  El usuario ha sido **desbaneado**",
                ephemeral: true
            })
        } catch (e) {
            interaction.reply({
                content: ":no_entry_sign:  Ha ocurrido un error, por favor, comprueba la consola",
                ephemeral: true
            });
            return console.log(e)
        }
    })

}
function banUser(interaction: ButtonInteraction) {

    let args = interaction.customId.split("-")
    // @ts-ignore
    let channel = interaction.guild?.channels.cache.get(process.env.CHANNEL_ID)
    if (!channel || channel.type !== "GUILD_TEXT") return;

    Appeal.findOne({ AppealID: args[2], Unbanned: false }, (err: any, res: any) => {
        if (!res) return interaction.reply({
            content: ":no_entry_sign:  Esta votación ya ha acabado!",
            ephemeral: true
        })

        res.Unbanned = true;
        res.save();

        let _voteYesButton = new MessageButton()
            .setStyle("SUCCESS")
            .setLabel("Desbanear")
            .setEmoji("947793548781166622")
            .setDisabled(true)
            .setCustomId(`btn-yes-${res.AppealID}`)

        let _voteNoButton = new MessageButton()
            .setStyle("DANGER")
            .setLabel("Banear")
            .setEmoji("947793548454002689")
            .setDisabled(true)
            .setCustomId(`btn-no-${res.AppealID}`)

        let _endButton = new MessageButton()
            .setStyle("PRIMARY")
            .setLabel("Terminar votación")
            .setEmoji("⌛ ")
            .setDisabled(true)
            .setCustomId(`btn-end-${res.AppealID}`)

        let embed = interaction.message.embeds[0]
        //@ts-ignore
        embed.setColor("#ED4245").setAuthor("Usuario no desbaneado", "https://i.phodit.xyz/oKA7KWDv6")

        //@ts-ignore
        interaction.message.edit({ components: [new MessageActionRow().addComponents(_voteYesButton, _voteNoButton, _endButton)], embeds: [embed] }).catch(e => { })

        return interaction.reply({
            content: "<:tick:947793548781166622>  El usuario **no** ha sido desbaneado",
            ephemeral: true
        })
    })
}
