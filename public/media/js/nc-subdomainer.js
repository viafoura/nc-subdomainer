$(document).ready(function(){
    reloadHosts();

    $("#addButton").click(function(evt){
        $.ajax({
            dataType: "json",
            type: "post",
            url: "/subdomain",
            data: $("#addForm").serialize(),
            success: function(res){
                console.log(res);
            }
        });
    });
});

var reloadHosts = function(){
    $.ajax({
        dataType: "json",
        url: "/subdomains",
        data: $("#addForm").serialize(),
        success: function(res){
            console.log(res);
        }
    });
}